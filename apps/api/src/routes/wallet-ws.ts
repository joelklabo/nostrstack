import type { FastifyBaseLogger,FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

type WalletSnapshot = {
  type: 'wallet';
  id?: string;
  name?: string;
  balance?: number;
  time: number;
};

export function createWalletFetcher(log: FastifyBaseLogger, baseUrl: string, apiKey: string) {
  let successiveFailures = 0;
  let lastFailureMsg = '';

  return async (): Promise<WalletSnapshot | null> => {
    if (process.env.LIGHTNING_PROVIDER === 'mock') {
      return {
        type: 'wallet',
        id: 'mock-wallet',
        name: 'Mock Wallet',
        balance: 50000,
        time: Math.floor(Date.now() / 1000)
      };
    }
    try {
      const res = await fetch(`${baseUrl}/api/v1/wallet`, {
        headers: {
          Accept: 'application/json',
          'X-Api-Key': apiKey
        }
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`lnbits http ${res.status}: ${text.slice(0, 200)}`);
      const json = JSON.parse(text) as { id?: string; name?: string; balance?: number };
      successiveFailures = 0;
      lastFailureMsg = '';
      return { type: 'wallet', id: json.id, name: json.name, balance: json.balance, time: Math.floor(Date.now() / 1000) };
    } catch (err) {
      successiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      
      // Warn on first failure, every 12th failure (~1 minute), or if error changed
      const shouldWarn = successiveFailures === 1 || successiveFailures % 12 === 0 || msg !== lastFailureMsg;
      
      if (shouldWarn) {
        log.warn({ err, successiveFailures }, 'wallet-ws fetch failed');
      } else {
        log.debug({ err, successiveFailures }, 'wallet-ws fetch failed (suppressed)');
      }
      
      lastFailureMsg = msg;
      return null;
    }
  };
}

export async function registerWalletWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const baseUrl = (process.env.LN_BITS_URL || '').replace(/\/$/, '');
  const apiKey = process.env.LN_BITS_API_KEY || '';

  if (!baseUrl || !apiKey) {
    app.log.warn('LN_BITS_URL/LN_BITS_API_KEY missing; /ws/wallet disabled');
    return;
  }

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!path.endsWith('/ws/wallet')) return;
    app.log.info('wallet ws upgrade');
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  let lastSnapshot: WalletSnapshot | null = null;

  const broadcast = (snap: WalletSnapshot) => {
    const payload = JSON.stringify(snap);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  };

  const fetchWallet = createWalletFetcher(app.log, baseUrl, apiKey);

  const interval = setInterval(async () => {
    const snap = await fetchWallet();
    if (!snap) return;
    const changed =
      !lastSnapshot ||
      snap.balance !== lastSnapshot.balance ||
      snap.id !== lastSnapshot.id ||
      snap.name !== lastSnapshot.name;
    if (changed) {
      lastSnapshot = snap;
      broadcast(snap);
    }
  }, 5000);

  wss.on('connection', async (ws) => {
    app.log.info({ clientCount: wss.clients.size }, 'wallet ws connection');
    if (lastSnapshot) {
      ws.send(JSON.stringify(lastSnapshot));
    } else {
      const snap = await fetchWallet();
      if (snap) {
        lastSnapshot = snap;
        ws.send(JSON.stringify(snap));
      }
    }
  });

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });

  app.get('/debug/ws-wallet', async () => ({ enabled: true, url: '/ws/wallet' }));
}