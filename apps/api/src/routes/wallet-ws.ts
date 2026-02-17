import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
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
  let lastErrorKey = '';
  let isStartup = true;
  let backoffUntil = 0;
  const STARTUP_FAILURE_THRESHOLD = 2;
  const BACKOFF_BASE_MS = 5000;
  const BACKOFF_MAX_MS = 60000;

  const reset = () => {
    successiveFailures = 0;
    lastErrorKey = '';
    isStartup = true;
    backoffUntil = 0;
  };

  const getErrorKey = (err: unknown): string => {
    if (err instanceof Error) {
      const name = err.name;
      if (name === 'FetchError' || name === 'TypeError') {
        const msg = err.message;
        const match = msg.match(/^(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ERR_)/i);
        if (match) return match[1] || match[0];
      }
      return name;
    }
    return String(err);
  };

  const fetchFn = async (): Promise<WalletSnapshot | null> => {
    if (Date.now() < backoffUntil) {
      return null;
    }
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
      lastErrorKey = '';
      isStartup = false;
      return {
        type: 'wallet',
        id: json.id,
        name: json.name,
        balance: json.balance,
        time: Math.floor(Date.now() / 1000)
      };
    } catch (err) {
      successiveFailures++;
      const errorKey = getErrorKey(err);

      const shouldWarn =
        (!isStartup || successiveFailures > STARTUP_FAILURE_THRESHOLD) &&
        (successiveFailures === 3 ||
          successiveFailures % 12 === 0 ||
          (successiveFailures > 3 && errorKey !== lastErrorKey));

      if (shouldWarn) {
        log.warn({ err, successiveFailures }, 'wallet-ws fetch failed');
      } else {
        log.debug({ err, successiveFailures }, 'wallet-ws fetch failed (suppressed)');
      }

      if (successiveFailures > 2) {
        const backoffMs = Math.min(
          BACKOFF_BASE_MS * Math.pow(2, Math.min(successiveFailures - 3, 10)),
          BACKOFF_MAX_MS
        );
        backoffUntil = Date.now() + backoffMs;
      }

      lastErrorKey = errorKey;
      return null;
    }
  };

  return { fetch: fetchFn, reset };
}

export async function registerWalletWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const baseUrl = (process.env.LN_BITS_URL || '').replace(/\/$/, '');
  const apiKey = process.env.LN_BITS_API_KEY || '';

  const isWalletEnabled = !!baseUrl && !!apiKey;

  if (!isWalletEnabled) {
    app.log.warn('LN_BITS_URL/LN_BITS_API_KEY missing; /ws/wallet disabled');
  }

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!path.endsWith('/ws/wallet')) return;
    if (!isWalletEnabled) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    app.log.info('wallet ws upgrade');
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  let lastSnapshot: WalletSnapshot | null = null;

  const hasClients = () => {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) count++;
    });
    return count > 0;
  };

  const broadcast = (snap: WalletSnapshot) => {
    const payload = JSON.stringify(snap);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  };

  const { fetch: fetchWallet, reset: resetWalletFailures } = createWalletFetcher(
    app.log,
    baseUrl,
    apiKey
  );

  const interval = setInterval(async () => {
    if (!hasClients()) return;
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
    resetWalletFailures();
    if (lastSnapshot) {
      ws.send(JSON.stringify(lastSnapshot));
    } else {
      const snap = await fetchWallet();
      if (snap) {
        lastSnapshot = snap;
        ws.send(JSON.stringify(snap));
      } else {
        app.log.debug('wallet ws initial fetch failed, will retry via interval');
      }
    }
  });

  app.addHook('onClose', async () => {
    clearInterval(interval);
    wss.close();
  });

  app.get(
    '/debug/ws-wallet',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              url: { type: 'string' }
            }
          }
        }
      }
    },
    async () => ({ enabled: isWalletEnabled, url: isWalletEnabled ? '/ws/wallet' : '' })
  );
}
