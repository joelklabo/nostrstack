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
  let walletId = (process.env.LN_BITS_WALLET_ID || '').trim();
  let successiveFailures = 0;
  let lastErrorKey = '';
  let isStartup = true;
  let backoffUntil = 0;
  let walletIdFallbackAttempted = false;
  const STARTUP_FAILURE_THRESHOLD = 2;
  const BACKOFF_BASE_MS = 5000;
  const BACKOFF_MAX_MS = 60000;

  const reset = () => {
    successiveFailures = 0;
    lastErrorKey = '';
    isStartup = true;
    backoffUntil = 0;
  };

  const extractErrorCode = (err: { message?: string; code?: string }): string | undefined => {
    if (typeof err?.code === 'string' && err.code.trim()) {
      return err.code.trim();
    }
    const msg = typeof err.message === 'string' ? err.message : '';
    const match = msg.match(
      /\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_[A-Z0-9_]+|ERR_[A-Z0-9_]+)\b/i
    );
    if (match) return match[1];
    return undefined;
  };

  const readErrorCode = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const asUnknown = value as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof asUnknown.code === 'string' && asUnknown.code.trim()) {
      return asUnknown.code.trim();
    }

    const codeFromMessage = extractErrorCode({
      message: typeof asUnknown.message === 'string' ? asUnknown.message : undefined,
      code: undefined
    });
    if (codeFromMessage) {
      return codeFromMessage;
    }

    return readErrorCode(asUnknown.cause);
  };

  const isTransientError = (errorKey: string | undefined): boolean =>
    !!errorKey &&
    [
      'OTHER_SIDE_CLOSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'UND_ERR_SOCKET',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_SOCKET_DID_CLOSE'
    ].includes(errorKey.toUpperCase());

  const getErrorKey = (err: unknown): string => {
    if (err instanceof Error) {
      const name = err.name;
      if (name === 'FetchError' || name === 'TypeError') {
        const code = extractErrorCode(err);
        const causeCode = readErrorCode((err as { cause?: unknown }).cause);

        if (causeCode) return causeCode.toUpperCase();
        if (code) return code.toUpperCase();

        const msg = err.message;
        if (/other side closed/i.test(msg)) return 'OTHER_SIDE_CLOSED';
      }
      if (typeof (err as { code?: string }).code === 'string') {
        return (err as { code?: string }).code!.toUpperCase();
      }
      return name;
    }
    return String(err);
  };

  const makeWalletUrl = (walletIdToUse: string) =>
    `${baseUrl}/api/v1/wallet${walletIdToUse ? `?usr=${encodeURIComponent(walletIdToUse)}` : ''}`;

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
      let walletUrl = makeWalletUrl(walletId);
      let res = await fetch(walletUrl, {
        headers: {
          Accept: 'application/json',
          'X-Api-Key': apiKey
        }
      });
      const text = await res.text();
      if (!res.ok) {
        if (
          res.status === 404 &&
          walletId &&
          !walletIdFallbackAttempted &&
          /wallet not found/i.test(text)
        ) {
          walletIdFallbackAttempted = true;
          walletId = '';
          walletUrl = makeWalletUrl(walletId);
          res = await fetch(walletUrl, {
            headers: {
              Accept: 'application/json',
              'X-Api-Key': apiKey
            }
          });
          const fallbackText = await res.text();
          if (res.ok) {
            const fallbackJson = JSON.parse(fallbackText) as {
              id?: string;
              name?: string;
              balance?: number;
            };
            successiveFailures = 0;
            lastErrorKey = '';
            isStartup = false;
            return {
              type: 'wallet',
              id: fallbackJson.id,
              name: fallbackJson.name,
              balance: fallbackJson.balance,
              time: Math.floor(Date.now() / 1000)
            };
          }
          throw new Error(`lnbits http ${res.status}: ${fallbackText.slice(0, 200)}`);
        }
        throw new Error(`lnbits http ${res.status}: ${text.slice(0, 200)}`);
      }
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
      const isTransientFailure = isTransientError(errorKey);

      const shouldWarn =
        !isTransientFailure &&
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

  const { fetch: fetchWallet } = createWalletFetcher(app.log, baseUrl, apiKey);

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

  app.get('/api/wallet-ws', async (req, reply) => {
    if (!isWalletEnabled) {
      return reply.status(503).send({
        error: 'wallet_not_configured',
        message: 'Wallet is not configured. Set LN_BITS_URL and LN_BITS_API_KEY.',
        websocketUrl: isWalletEnabled ? '/ws/wallet' : null
      });
    }
    return reply.status(400).send({
      error: 'invalid_endpoint',
      message:
        'This is a WebSocket endpoint. Connect using WebSocket protocol at ws://<host>/ws/wallet',
      websocketUrl: '/ws/wallet'
    });
  });
}
