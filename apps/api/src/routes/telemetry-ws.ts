// path reserved for future compose path usage (currently unused)

import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

import { env } from '../env.js';
import { type TelemetrySource } from '../telemetry/bitcoind.js';
import { telemetryPollFailuresCounter } from '../telemetry/metrics.js';
import { getTelemetryProvider } from '../telemetry/providers.js';

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
    source?: TelemetrySource;
  }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number }
  | { type: 'error'; message: string; time: number };

type TelemetryBlockEvent = Extract<TelemetryEvent, { type: 'block' }>;

export async function registerTelemetryWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const provider = getTelemetryProvider();

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

  // lightweight poll: getblockcount every 5s with backoff on RPC overload
  const POLL_BASE_MS = 5000;
  const POLL_MAX_MS = 60000;
  const BACKPRESSURE_LOG_COOLDOWN_MS = 5 * 60 * 1000;
  let pollDelayMs = POLL_BASE_MS;
  let nextPollAt = Date.now();
  let pollInFlight = false;
  let lastErrorMsg: string | null = null;
  let lastErrorAt = 0;

  let lastHeight = -1;
  let lastHash: string | null = null;
  let lastBlockTime: number | null = null;

  const recordPollFailure = (message: string) => {
    const lower = message.toLowerCase();
    const reason =
      lower.includes('http 503') || lower.includes('work queue depth exceeded')
        ? 'backpressure'
        : lower.includes('timeout')
          ? 'timeout'
          : 'rpc_error';
    telemetryPollFailuresCounter.labels(reason).inc();
    return reason;
  };

  const fetchBlock = async (height: number): Promise<TelemetryBlockEvent | null> => {
    try {
      const summary = await provider.fetchSummaryForHeight(height, lastBlockTime);
      return { type: 'block', source: provider.source, ...summary };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordPollFailure(msg);
      app.log.warn({ err }, 'telemetry fetchBlock failed');
      broadcastError(`telemetry ${provider.source} fetch failed; check node status`);
      return null;
    }
  };

  // Prime with current tip so new clients see data immediately
  let useMock = provider.source === 'mock';
  if (!useMock) {
    try {
      const tip = await provider.fetchTipHeight();
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
        app.log.warn('telemetry provider returned non-numeric block height, switching to mock telemetry');
      }
    } catch (err) {
      app.log.warn({ err }, 'telemetry initial tip fetch failed, switching to mock telemetry');
      useMock = true;
    }
  }

  if (useMock) {
    // Mock simulation
    const mockNetwork = env.BITCOIN_NETWORK || 'mocknet';
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
      network: mockNetwork,
      version: 70016,
      subversion: '/Satoshi:26.0.0/',
      connections: 8,
      source: 'mock'
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
          network: mockNetwork,
          version: 70016,
          subversion: '/Satoshi:26.0.0/',
          connections: 8 + Math.floor(Math.random() * 5),
          source: 'mock'
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
    const now = Date.now();
    if (pollInFlight || now < nextPollAt) return;
    pollInFlight = true;
    try {
      const height = await provider.fetchTipHeight();
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
        broadcastError('telemetry provider block height unavailable');
      }
      pollDelayMs = POLL_BASE_MS;
      nextPollAt = Date.now() + pollDelayMs;
      lastErrorMsg = null;
      lastErrorAt = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorAt = Date.now();
      const reason = recordPollFailure(msg);
      const isBackpressure = reason === 'backpressure';
      pollDelayMs = Math.min(POLL_MAX_MS, Math.max(POLL_BASE_MS, pollDelayMs * 2));
      nextPollAt = errorAt + pollDelayMs;
      const logCooldown = isBackpressure ? BACKPRESSURE_LOG_COOLDOWN_MS : 60000;
      if (msg !== lastErrorMsg || errorAt - lastErrorAt > logCooldown) {
        if (isBackpressure) {
          app.log.info({ err, pollDelayMs }, 'telemetry poll backpressure, backing off');
        } else {
          app.log.warn({ err, pollDelayMs }, 'telemetry block poll failed');
        }
        lastErrorMsg = msg;
        lastErrorAt = errorAt;
        broadcastError(isBackpressure ? 'telemetry backpressure; retrying' : 'telemetry poll failed; see API logs');
      }
    } finally {
      pollInFlight = false;
    }
  }, POLL_BASE_MS);

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });
}
