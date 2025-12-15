import type { FastifyInstance } from 'fastify';

import { getTenantForRequest } from '../tenant-resolver.js';

const PAID_STATES = ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'] as const;

function parseMaybeJson(raw: string | null): unknown | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function registerTipRoutes(app: FastifyInstance) {
  app.get('/api/tips', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          itemId: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 }
        },
        required: ['itemId'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { domain, itemId, limit } = request.query as { domain?: string; itemId: string; limit?: number };
    const tenant = await getTenantForRequest(app, request, domain);

    const take = Math.min(100, Math.max(1, limit ?? 25));
    const where = {
      tenantId: tenant.id,
      action: 'tip',
      itemId,
      status: { in: PAID_STATES as unknown as string[] }
    } as const;

    const [rows, agg] = await Promise.all([
      app.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take
      }),
      app.prisma.payment.aggregate({
        where,
        _count: { _all: true },
        _sum: { amountSats: true }
      })
    ]);

    return reply.send({
      itemId,
      count: agg._count?._all ?? 0,
      totalAmountSats: agg._sum?.amountSats ?? 0,
      tips: rows.map((p) => ({
        id: p.providerRef,
        paymentId: p.id,
        amountSats: p.amountSats,
        createdAt: p.createdAt,
        providerRef: p.providerRef,
        metadata: parseMaybeJson(p.metadata)
      }))
    });
  });
}
