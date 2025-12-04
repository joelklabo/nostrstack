import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

type WalletSnapshot = {
  type: 'wallet';
  id?: string;
  name?: string;
  balance?: number;
  time: number;
};

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
    if (req.url !== '/ws/wallet') return;
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

  const fetchWallet = async (): Promise<WalletSnapshot | null> => {
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
      return { type: 'wallet', id: json.id, name: json.name, balance: json.balance, time: Math.floor(Date.now() / 1000) };
    } catch (err) {
      app.log.warn({ err }, 'wallet-ws fetch failed');
      return null;
    }
  };

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
