import type { IncomingMessage } from 'node:http';

import type { FastifyInstance } from 'fastify';
import WebSocket, { WebSocketServer } from 'ws';

import type { PayEvent } from '../services/pay-events.js';
import { tipsWsConnectionsCounter, tipsWsErrorsCounter } from '../telemetry/metrics.js';

type TipEvent = {
  type: 'tip';
  itemId: string;
  amount: number;
  createdAt: string;
  providerRef: string;
  paymentId?: string;
  metadata?: unknown;
};

type TipErrorEvent = {
  type: 'error';
  message: string;
  time: number;
};

const MAX_CLIENTS = 100;
const MAX_ITEM_ID_LENGTH = 200;

const parseQuery = (req: IncomingMessage) => {
  try {
    const base = `http://${req.headers.host ?? 'localhost'}`;
    const url = new URL(req.url ?? '', base);
    return {
      itemId: url.searchParams.get('itemId')?.trim() ?? '',
      domain: url.searchParams.get('domain')?.trim() ?? ''
    };
  } catch {
    return { itemId: '', domain: '' };
  }
};

const sendError = (ws: WebSocket, message: string) => {
  const payload: TipErrorEvent = { type: 'error', message, time: Math.floor(Date.now() / 1000) };
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
  ws.close(1008, message.slice(0, 120));
};

export async function registerTipsWs(app: FastifyInstance) {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });
  const clientInfo = new WeakMap<WebSocket, { itemId: string; tenantId: string }>();
  let unsubscribe: (() => void) | null = null;

  const resolveTenantId = async (req: IncomingMessage, domainOverride?: string) => {
    const hostHeader = (req.headers['x-forwarded-host'] ?? req.headers.host ?? 'default').toString();
    const hostDomain = hostHeader.split(',')[0].trim().toLowerCase() || 'default';
    const rawDomain = (domainOverride ?? hostDomain).trim().toLowerCase() || 'default';
    const domain = rawDomain.split(':')[0] || 'default';
    const found = await app.prisma.tenant.findUnique({ where: { domain } });
    if (found) return found.id;
    const fallback = await app.prisma.tenant.findUnique({ where: { domain: 'default' } });
    if (fallback) return fallback.id;
    const created = await app.prisma.tenant.create({ data: { domain: 'default', displayName: 'Default Tenant' } });
    return created.id;
  };

  const handlePayEvent = async (ev: PayEvent) => {
    if (ev.type !== 'invoice-paid') return;
    const action = ev.action?.toLowerCase();
    if (action !== 'tip') return;
    if (!ev.itemId) return;
    const amount = Number(ev.amount);
    if (!Number.isFinite(amount)) return;

    let tenantId = ev.tenantId;
    if (!tenantId && ev.providerRef) {
      try {
        const payment = await app.prisma.payment.findFirst({ where: { providerRef: ev.providerRef } });
        tenantId = payment?.tenantId;
      } catch (err) {
        app.log.warn({ err, providerRef: ev.providerRef }, 'tips-ws tenant lookup failed');
      }
    }
    if (!tenantId) return;

    const payload: TipEvent = {
      type: 'tip',
      itemId: ev.itemId,
      amount,
      createdAt: new Date(ev.ts).toISOString(),
      providerRef: ev.providerRef,
      paymentId: ev.paymentId,
      metadata: ev.metadata
    };
    const serialized = JSON.stringify(payload);

    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const info = clientInfo.get(client);
      if (!info) return;
      if (info.tenantId !== tenantId) return;
      if (info.itemId !== ev.itemId) return;
      client.send(serialized);
    });
  };

  const ensureSubscription = () => {
    if (unsubscribe || !app.payEventHub?.subscribe) return;
    unsubscribe = app.payEventHub.subscribe(handlePayEvent);
  };

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (!path.endsWith('/ws/tips')) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (ws, req) => {
    if (wss.clients.size > MAX_CLIENTS) {
      tipsWsErrorsCounter.labels('capacity').inc();
      sendError(ws, 'Server at capacity. Try again later.');
      return;
    }

    const { itemId, domain } = parseQuery(req);
    if (!itemId) {
      tipsWsErrorsCounter.labels('missing_item_id').inc();
      sendError(ws, 'itemId is required');
      return;
    }
    if (itemId.length > MAX_ITEM_ID_LENGTH) {
      tipsWsErrorsCounter.labels('item_id_too_long').inc();
      sendError(ws, 'itemId is too long');
      return;
    }

    const tenantId = await resolveTenantId(req, domain || undefined);
    clientInfo.set(ws, { itemId, tenantId });
    tipsWsConnectionsCounter.labels('accepted').inc();
    app.log.info({ itemId, tenantId, clientCount: wss.clients.size }, 'tips ws connection');
    ensureSubscription();

    ws.on('error', (err) => {
      tipsWsErrorsCounter.labels('socket_error').inc();
      app.log.warn({ err }, 'tips ws client error');
    });
  });

  app.addHook('onClose', async () => {
    unsubscribe?.();
    wss.close();
  });
}
