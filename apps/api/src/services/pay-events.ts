import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

type PayEventBase = {
  tenantId?: string;
  paymentId?: string;
};

export type PayEvent =
  | (PayEventBase & {
      type: 'invoice-created';
      ts: number;
      pr: string;
      providerRef: string;
      amount: number;
      status: string;
      action?: string;
      itemId?: string;
      metadata?: unknown;
    })
  | (PayEventBase & {
      type: 'invoice-status';
      ts: number;
      providerRef: string;
      status: string;
      prevStatus?: string;
      pr?: string;
      amount?: number;
      action?: string;
      itemId?: string;
      metadata?: unknown;
      source?: 'poll' | 'reconciler' | 'webhook' | 'lnurl' | 'regtest';
    })
  | (PayEventBase & {
      type: 'invoice-paid';
      ts: number;
      pr: string;
      providerRef: string;
      amount: number;
      action?: string;
      itemId?: string;
      metadata?: unknown;
      source?: 'poll' | 'reconciler' | 'webhook' | 'lnurl' | 'regtest';
    });

type PayEventListener = (ev: PayEvent) => void | Promise<void>;

export function createPayEventHub(server: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });
  const listeners = new Set<PayEventListener>();

  server.server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!path.endsWith('/ws/pay')) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  const broadcast = (ev: PayEvent) => {
    const payload = JSON.stringify(ev);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
    listeners.forEach((listener) => {
      try {
        const result = listener(ev);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            server.log.warn({ err }, 'payEventHub listener failed');
          });
        }
      } catch (err) {
        server.log.warn({ err }, 'payEventHub listener failed');
      }
    });
  };

  const subscribe = (listener: PayEventListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  server.decorate('payEventHub', { broadcast, subscribe });

  server.addHook('onClose', async () => {
    wss.close();
    listeners.clear();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    payEventHub?: { broadcast: (ev: PayEvent) => void; subscribe: (listener: PayEventListener) => () => void };
  }
}
