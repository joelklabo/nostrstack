import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

export type PayEvent =
  | {
      type: 'invoice-created';
      ts: number;
      pr: string;
      providerRef: string;
      amount: number;
      status: string;
      action?: string;
      itemId?: string;
      metadata?: unknown;
    }
  | {
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
    }
  | {
      type: 'invoice-paid';
      ts: number;
      pr: string;
      providerRef: string;
      amount: number;
      action?: string;
      itemId?: string;
      metadata?: unknown;
      source?: 'poll' | 'reconciler' | 'webhook' | 'lnurl' | 'regtest';
    };

export function createPayEventHub(server: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });

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
  };

  server.decorate('payEventHub', { broadcast });

  server.addHook('onClose', async () => {
    wss.close();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    payEventHub?: { broadcast: (ev: PayEvent) => void };
  }
}
