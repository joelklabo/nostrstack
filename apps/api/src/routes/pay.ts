import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

export async function registerPayRoutes(app: FastifyInstance) {
  app.post(
    '/api/pay',
    {
      schema: {
        description: 'Create a new Lightning invoice for a specific action (e.g. unlock content)',
        tags: ['Payments'],
        summary: 'Create Payment',
        body: {
          type: 'object',
          description: 'Payment creation request',
          properties: {
            domain: {
              type: 'string',
              description: 'Tenant domain',
              example: 'demo.nostrstack.lol'
            },
            action: { type: 'string', description: 'Action identifier', example: 'unlock' },
            amount: {
              type: 'integer',
              minimum: 1,
              description: 'Amount in satoshis',
              example: 100
            },
            metadata: {
              type: 'object',
              description: 'Arbitrary metadata to attach',
              additionalProperties: true,
              example: { itemId: '123' }
            }
          },
          required: ['domain', 'action', 'amount'],
          additionalProperties: false
        },
        response: {
          201: {
            description: 'Payment created successfully',
            type: 'object',
            properties: {
              status: { type: 'string', example: 'pending' },
              payment_request: { type: 'string', description: 'BOLT11 invoice' },
              pr: { type: 'string', description: 'Alias for payment_request' },
              provider_ref: { type: 'string', description: 'Internal provider reference ID' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as {
        domain: string;
        action: string;
        amount: number;
        metadata?: Record<string, unknown>;
      };
      const tenant = await getTenantForRequest(app, request, body.domain);
      const origin = originFromRequest(request, env.PUBLIC_ORIGIN);

      const charge = await app.lightningProvider.createCharge({
        amount: body.amount,
        description: `pay:${body.action} ${body.metadata?.path ?? ''}`.trim(),
        callbackUrl: `${origin}/api/lnurlp/${encodeURIComponent('pay')}/webhook`,
        webhookUrl: `${origin}/api/pay/webhook/lnbits`
      });

      const payment = await app.prisma.payment.create({
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

      app.payEventHub?.broadcast({
        type: 'invoice-created',
        ts: Date.now(),
        pr: charge.invoice,
        providerRef: charge.id,
        amount: body.amount,
        status: 'PENDING',
        action: body.action,
        itemId: typeof body.metadata?.itemId === 'string' ? body.metadata.itemId : undefined,
        metadata: body.metadata,
        tenantId: payment.tenantId,
        paymentId: payment.id
      });

      const response = {
        status: 'pending',
        payment_request: charge.invoice,
        pr: charge.invoice,
        provider_ref: charge.id
      };

      return reply.code(201).send(response);
    }
  );

  app.get(
    '/api/lnurlp/pay/status/:id',
    {
      schema: {
        description: 'Check the status of a specific payment by its provider reference ID',
        tags: ['Payments'],
        summary: 'Get Payment Status',
        params: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Provider reference ID' } },
          required: ['id'],
          additionalProperties: false
        },
        querystring: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Tenant domain' }
          },
          additionalProperties: false
        },
        response: {
          200: {
            description: 'Payment status retrieved',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Payment status (e.g. PAID, PENDING)',
                example: 'PAID'
              },
              amountSats: { type: 'integer', description: 'Amount in satoshis' }
            }
          },
          202: {
            description: 'Status check pending or failed transiently',
            type: 'object',
            properties: {
              status: { type: 'string' },
              error: { type: 'string' }
            }
          },
          404: {
            description: 'Payment not found',
            type: 'object',
            properties: {
              status: { type: 'string', example: 'unknown' }
            }
          }
        }
      }
    },
    async (request, reply) => {
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
        if (normalized !== payment.status) {
          await app.prisma.payment.update({
            where: { id: payment.id },
            data: { status: normalized }
          });
          let metadata: unknown | undefined;
          if (payment.metadata) {
            try {
              metadata = JSON.parse(payment.metadata) as unknown;
            } catch {
              metadata = undefined;
            }
          }
          const ts = Date.now();
          app.payEventHub?.broadcast({
            type: 'invoice-status',
            ts,
            providerRef: id,
            status: normalized,
            prevStatus: payment.status,
            pr: payment.invoice,
            amount: payment.amountSats,
            action: payment.action ?? undefined,
            itemId: payment.itemId ?? undefined,
            metadata,
            source: 'poll',
            tenantId: payment.tenantId,
            paymentId: payment.id
          });
          if (paidStates.includes(normalized)) {
            app.payEventHub?.broadcast({
              type: 'invoice-paid',
              ts,
              pr: payment.invoice,
              providerRef: id,
              amount: payment.amountSats,
              action: payment.action ?? undefined,
              itemId: payment.itemId ?? undefined,
              metadata,
              source: 'poll',
              tenantId: payment.tenantId,
              paymentId: payment.id
            });
          }
        }
        return reply.send({ status: normalized });
      } catch (err) {
        app.log.warn({ err }, 'charge status check failed');
        return reply.code(202).send({ status: payment.status, error: 'status_check_failed' });
      }
    }
  );

  app.get(
    '/api/pay/ws-placeholder',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' } }
          }
        }
      }
    },
    async (_req, reply) => {
      // Placeholder: front-end can switch to /ws/telemetry for now
      return reply.send({ ok: true });
    }
  );
}
