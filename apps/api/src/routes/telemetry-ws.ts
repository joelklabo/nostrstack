// path reserved for future compose path usage (currently unused)

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
    network?: string;
    version?: number;
    subversion?: string;
    connections?: number;
  }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number }
  | { type: 'error'; message: string; time: number };

type TelemetryBlockEvent = Extract<TelemetryEvent, { type: 'block' }>;

export async function registerTelemetryWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const rpcUrlRaw = process.env.BITCOIND_RPC_URL || 'http://bitcoin:bitcoin@localhost:18443';
  const rpcUrlParsed = new URL(rpcUrlRaw);
  const rpcAuthHeader =
    rpcUrlParsed.username || rpcUrlParsed.password
      ? 'Basic ' + Buffer.from(`${decodeURIComponent(rpcUrlParsed.username)}:${decodeURIComponent(rpcUrlParsed.password)}`).toString('base64')
      : undefined;
  // Drop creds from URL because undici/fetch rejects credentialed URLs
  rpcUrlParsed.username = '';
  rpcUrlParsed.password = '';
  const rpcUrl = rpcUrlParsed.toString();

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!path.endsWith('/ws/telemetry')) return;
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

  let lastEvent: TelemetryBlockEvent | null = null;
  let lastErrorEvent: TelemetryEvent | null = null;

  const broadcastError = (message: string) => {
    const ev: TelemetryEvent = { type: 'error', message, time: Math.floor(Date.now() / 1000) };
    lastErrorEvent = ev;
    broadcast(ev);
  };

  wss.on('connection', (ws) => {
    app.log.info({ clientCount: wss.clients.size }, 'telemetry ws connection');
    if (ws.readyState === WebSocket.OPEN) {
      if (lastEvent) {
        ws.send(JSON.stringify(lastEvent));
      } else if (lastErrorEvent) {
        ws.send(JSON.stringify(lastErrorEvent));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Waiting for block data…', time: Math.floor(Date.now() / 1000) } satisfies TelemetryEvent));
      }
    }
  });

  const rpcCall = async (method: string, params: unknown[] = []) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'telemetry', method, params });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (rpcAuthHeader) headers.Authorization = rpcAuthHeader;
    const res = await fetch(rpcUrl, { method: 'POST', headers, body });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`rpc ${method} http ${res.status} ${txt}`);
    }
    const data = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
    if (data.error) throw new Error(`rpc ${method} error ${data.error.code}: ${data.error.message}`);
    return data.result;
  };

  // lightweight poll: getblockcount every 5s
  let lastErrorMsg: string | null = null;
  let lastErrorAt = 0;

  let lastHeight = -1;
  let lastHash: string | null = null;
  let lastBlockTime: number | null = null;

  const fetchBlock = async (height: number): Promise<TelemetryBlockEvent | null> => {
    try {
      const hash = (await rpcCall('getblockhash', [height])) as string;
      if (!hash) return null;

      const block = (await rpcCall('getblock', [hash, 1])) as {
        time?: number;
        tx?: string[];
        nTx?: number;
        size?: number;
        weight?: number;
      };
      const time = Number(block.time) || Date.now() / 1000;
      const txs = Array.isArray(block.tx) ? block.tx.length : Number(block.nTx) || 0;
      const size = Number(block.size) || 0;
      const weight = Number(block.weight) || 0;
      const mempool = (await rpcCall('getmempoolinfo').catch(() => null)) as { size?: number; bytes?: number } | null;
      const networkInfo = (await rpcCall('getnetworkinfo').catch(() => null)) as { version?: number; subversion?: string; connections?: number } | null;
      const blockchainInfo = (await rpcCall('getblockchaininfo').catch(() => null)) as { chain?: string } | null;

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
        mempoolBytes: mempool?.bytes,
        network: blockchainInfo?.chain,
        version: networkInfo?.version,
        subversion: networkInfo?.subversion,
        connections: networkInfo?.connections
      };
    } catch (err) {
      app.log.warn({ err }, 'telemetry fetchBlock failed');
      broadcastError('bitcoind RPC call failed; check node status');
      return null;
    }
  };

  // Prime with current tip so new clients see data immediately
  let useMock = false;
  try {
    const tip = Number(await rpcCall('getblockcount'));
    if (Number.isFinite(tip)) {
      const ev = await fetchBlock(tip);
      if (ev) {
        lastHeight = ev.height;
        lastHash = ev.hash || lastHash;
        lastBlockTime = ev.time;
        lastEvent = ev;
      }
    } else {
      useMock = true;
      app.log.warn('bitcoind returned non-numeric block height, switching to mock telemetry');
    }
  } catch (err) {
    app.log.warn({ err }, 'telemetry initial tip fetch failed, switching to mock telemetry');
    useMock = true;
  }

  if (useMock) {
    // Mock simulation
    let mockHeight = 820000;
    let mockHash = '000000000000000000035c1ec826f03027878434757045197825310657158739';
    
    // Simulate initial block
    lastEvent = {
      type: 'block',
      height: mockHeight,
      hash: mockHash,
      time: Math.floor(Date.now() / 1000),
      txs: 2500,
      size: 1500000,
      weight: 3990000,
      mempoolTxs: 15000,
      mempoolBytes: 35000000,
      network: 'mocknet',
      version: 70016,
      subversion: '/Satoshi:26.0.0/',
      connections: 8
    };

    const mockInterval = setInterval(() => {
      // 10% chance of a new block every 2 seconds (avg block time 20s)
      if (Math.random() < 0.1) {
        mockHeight++;
        mockHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const now = Math.floor(Date.now() / 1000);
        const interval = now - (lastBlockTime || (now - 600));
        lastBlockTime = now;
        
        const blockEvent: TelemetryBlockEvent = {
          type: 'block',
          height: mockHeight,
          hash: mockHash,
          time: now,
          txs: 1000 + Math.floor(Math.random() * 3000),
          size: 1000000 + Math.floor(Math.random() * 1000000),
          weight: 3000000 + Math.floor(Math.random() * 1000000),
          interval,
          mempoolTxs: 5000 + Math.floor(Math.random() * 20000),
          mempoolBytes: 10000000 + Math.floor(Math.random() * 50000000),
          network: 'mocknet',
          version: 70016,
          subversion: '/Satoshi:26.0.0/',
          connections: 8 + Math.floor(Math.random() * 5)
        };
        lastEvent = blockEvent;
        broadcast(blockEvent);
      } 
      // 50% chance of a random tx or info log
      else if (Math.random() < 0.5) {
        // Emit a random log to keep the feed alive
        // (Note: The UI currently only logs 'error' or 'block' events for the main log, 
        // but we can emit other types if the UI supports them or just internal noise)
        // For the "Activity Log" in TelemetryBar.tsx, it renders 'error' messages. 
        // Let's not spam errors. The UI also renders blocks. 
        // We could emit a custom type if we wanted, but let's stick to blocks for now 
        // to avoid breaking the UI which expects specific types.
      }
    }, 2000);

    app.addHook('onClose', async () => {
      clearInterval(mockInterval);
      wss.close();
    });

    return; // Exit early, don't start the real poller
  }

  const interval = setInterval(async () => {
    try {
      const height = Number(await rpcCall('getblockcount'));
      if (Number.isFinite(height) && height !== lastHeight) {
        const event = await fetchBlock(height);
        if (event) {
          lastHeight = event.height;
          lastHash = event.hash || lastHash;
          lastBlockTime = event.time;
          lastEvent = event;
          lastErrorEvent = null;
          broadcast(event);
        }
      } else if (!Number.isFinite(height)) {
        broadcastError('bitcoind block height unavailable');
      }
      lastErrorMsg = null;
      lastErrorAt = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const now = Date.now();
      if (msg !== lastErrorMsg || now - lastErrorAt > 60000) {
        app.log.warn({ err }, 'telemetry block poll failed');
        lastErrorMsg = msg;
        lastErrorAt = now;
        broadcastError('telemetry poll failed; see API logs');
      }
    }
  }, 5000);

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });
}
