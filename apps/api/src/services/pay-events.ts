import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

export type PayEvent = { type: 'invoice-paid'; pr: string; providerRef: string; amount: number };

export function createPayEventHub(server: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });

  server.server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws/pay') return;
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

