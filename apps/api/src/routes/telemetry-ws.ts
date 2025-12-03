import { spawn } from 'node:child_process';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

type TelemetryEvent =
  | {
    type: 'block';
    height: number;
    hash: string;
    time: number;
    txs?: number;
    size?: number;
    weight?: number;
    interval?: number;
    mempoolTxs?: number;
    mempoolBytes?: number;
  }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number };

export async function registerTelemetryWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const defaultRoot = path.resolve(process.cwd(), '..', '..');
  const defaultCompose = path.join(defaultRoot, 'deploy/regtest/docker-compose.yml');
  const defaultCwd = path.dirname(defaultCompose);

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws/telemetry') return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  const broadcast = (ev: TelemetryEvent) => {
    const payload = JSON.stringify(ev);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  };

  const execCli = (cmd: string) =>
    new Promise<string>((resolve, reject) => {
      const composeFile = app.config?.REGTEST_COMPOSE ?? defaultCompose;
      const cwd = app.config?.REGTEST_CWD ?? defaultCwd;
      const composeResolved = path.isAbsolute(composeFile) ? composeFile : path.resolve(cwd, composeFile);
      const p = spawn('docker', [
        'compose', '-f', composeResolved, 'exec', '-T', 'bitcoind',
        'bitcoin-cli', '-regtest', '-rpcuser=bitcoin', '-rpcpassword=bitcoin', cmd
      ], { cwd });
      let out = '';
      let err = '';
      p.stdout.on('data', (d) => (out += d.toString()));
      p.stderr.on('data', (d) => (err += d.toString()));
      p.on('close', (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err || `exit ${code}`));
      });
    });

  // lightweight poll: getblockcount every 5s
  let lastError: string | null = null;
  let lastErrorAt = 0;

  let lastHeight = -1;
  let lastHash: string | null = null;
  let lastBlockTime: number | null = null;

  const fetchBlock = async (height: number): Promise<TelemetryEvent | null> => {
    try {
      const hash = (await execCli(`getblockhash ${height}`)).trim();
      if (!hash) return null;

      const blockRaw = await execCli(`getblock ${hash} 1`);
      const block = JSON.parse(blockRaw);
      const time = Number(block.time) || Date.now() / 1000;
      const txs = Array.isArray(block.tx) ? block.tx.length : Number(block.nTx) || 0;
      const size = Number(block.size) || 0;
      const weight = Number(block.weight) || 0;
      const mempool = await execCli('getmempoolinfo')
        .then((out) => JSON.parse(out))
        .catch(() => null);

      const interval = lastBlockTime ? Math.max(0, time - lastBlockTime) : null;

      return {
        type: 'block',
        height,
        hash,
        time,
        txs,
        size,
        weight,
        interval: interval ?? undefined,
        mempoolTxs: mempool?.size,
        mempoolBytes: mempool?.bytes
      };
    } catch {
      // retry on next poll; do not broadcast incomplete data
      return null;
    }
  };

  const interval = setInterval(async () => {
    try {
      const out = await execCli('getblockcount');
      const height = Number(out.trim());
      if (Number.isFinite(height) && height !== lastHeight) {
        const event = await fetchBlock(height);
        if (event) {
          lastHeight = event.height;
          lastHash = event.hash || lastHash;
          lastBlockTime = event.time;
          broadcast(event);
        }
      }
      lastError = null;
      lastErrorAt = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const now = Date.now();
      if (msg !== lastError || now - lastErrorAt > 60000) {
        app.log.warn({ err }, 'telemetry block poll failed');
        lastError = msg;
        lastErrorAt = now;
      }
    }
  }, 5000);

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });
}
