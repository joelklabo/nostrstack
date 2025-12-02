import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';

type TelemetryEvent =
  | { type: 'block'; height: number; hash: string; time: number }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number };

export async function registerTelemetryWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });

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
      const p = spawn('docker', [
        'compose', '-f', 'deploy/regtest/docker-compose.yml', 'exec', '-T', 'bitcoind',
        'bitcoin-cli', '-regtest', '-rpcuser=bitcoin', '-rpcpassword=bitcoin', cmd
      ], { cwd: process.cwd() });
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
  const interval = setInterval(async () => {
    try {
      const out = await execCli('getblockcount');
      const height = Number(out.trim());
      broadcast({ type: 'block', height, hash: '', time: Date.now() / 1000 });
    } catch (err) {
      app.log.warn({ err }, 'telemetry block poll failed');
    }
  }, 5000);

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });
}
