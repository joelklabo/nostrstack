import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

export async function registerPayRoutes(app: FastifyInstance) {
  app.post('/api/pay', {
    schema: {
      body: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          action: { type: 'string' },
          amount: { type: 'integer', minimum: 1 },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['domain', 'action', 'amount'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const body = request.body as { domain: string; action: string; amount: number; metadata?: Record<string, unknown> };
    const tenant = await getTenantForRequest(app, request, body.domain);
    const origin = originFromRequest(request, env.PUBLIC_ORIGIN);

    const charge = await app.lightningProvider.createCharge({
      amount: body.amount,
      description: `pay:${body.action} ${body.metadata?.path ?? ''}`.trim(),
      callbackUrl: `${origin}/api/lnurlp/${encodeURIComponent('pay')}/webhook`,
      webhookUrl: `${origin}/api/pay/webhook/lnbits`
    });

    await app.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        userId: null,
        provider: env.LIGHTNING_PROVIDER,
        providerRef: charge.id,
        invoice: charge.invoice,
        action: body.action,
        itemId: typeof body.metadata?.itemId === 'string' ? body.metadata.itemId : null,
        amountSats: body.amount,
        status: 'PENDING',
        metadata: body.metadata ? JSON.stringify(body.metadata) : null
      }
    });

    const response = {
      status: 'pending',
      payment_request: charge.invoice,
      pr: charge.invoice,
      provider_ref: charge.id
    };

    return reply.code(201).send(response);
  });

  app.get('/api/lnurlp/pay/status/:id', {
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      querystring: {
        type: 'object',
        properties: {
          domain: { type: 'string' }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { domain } = (request.query as { domain?: string } | undefined) ?? {};
    const tenant = await getTenantForRequest(app, request, domain);
    const payment = await app.prisma.payment.findFirst({
      where: { providerRef: id, tenantId: tenant.id }
    });
    if (!payment) return reply.code(404).send({ status: 'unknown' });

    const paidStates = ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'];
    if (paidStates.includes(payment.status)) {
      return reply.send({ status: payment.status, amountSats: payment.amountSats });
    }

    // If provider can't give status, return current known state
    if (!app.lightningProvider.getCharge) {
      return reply.send({ status: payment.status });
    }

    try {
      const statusRes = await app.lightningProvider.getCharge(id);
      const normalized = statusRes?.status?.toUpperCase?.() ?? payment.status;
      if (paidStates.includes(normalized)) {
        await app.prisma.payment.update({ where: { id: payment.id }, data: { status: normalized } });
        let metadata: unknown | undefined;
        if (payment.metadata) {
          try {
            metadata = JSON.parse(payment.metadata) as unknown;
          } catch {
            metadata = undefined;
          }
        }
        app.payEventHub?.broadcast({
          type: 'invoice-paid',
          pr: payment.invoice,
          providerRef: id,
          amount: payment.amountSats,
          action: payment.action ?? undefined,
          itemId: payment.itemId ?? undefined,
          metadata
        });
      }
      return reply.send({ status: normalized });
    } catch (err) {
      app.log.warn({ err }, 'charge status check failed');
      return reply.code(202).send({ status: payment.status, error: 'status_check_failed' });
    }
  });

  app.get('/api/pay/ws-placeholder', async (_req, reply) => {
    // Placeholder: front-end can switch to /ws/telemetry for now
    return reply.send({ ok: true });
  });
}
