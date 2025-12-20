import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import {
  buildWithdrawLnurl,
  buildWithdrawRequest,
  createWithdrawSession,
  getWithdrawSession,
  settleWithdrawInvoice
} from '../services/lnurl-withdraw.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

function formatWithdrawError(err: unknown) {
  if (err instanceof Error) {
    if (err.message.startsWith('lnbits_config_missing')) return 'lnbits_config_missing';
    if (err.message.startsWith('provider_not_supported')) return 'provider_not_supported';
    if (err.message.startsWith('lnbits_pay_failed')) return 'lnbits_pay_failed';
  }
  return 'withdraw_failed';
}

export async function registerLnurlWithdrawRoutes(app: FastifyInstance) {
  app.post('/api/lnurl-withdraw/request', {
    schema: {
      body: {
        type: 'object',
        properties: {
          minWithdrawable: { type: 'integer', minimum: 1 },
          maxWithdrawable: { type: 'integer', minimum: 1 },
          defaultDescription: { type: 'string' }
        },
        required: ['minWithdrawable', 'maxWithdrawable'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    if (!env.ENABLE_LNURL_WITHDRAW) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const { minWithdrawable, maxWithdrawable, defaultDescription } = request.body as {
      minWithdrawable: number;
      maxWithdrawable: number;
      defaultDescription?: string;
    };
    if (minWithdrawable > maxWithdrawable) {
      return reply.badRequest('minWithdrawable must be <= maxWithdrawable');
    }
    const tenant = await getTenantForRequest(app, request);
    const session = await createWithdrawSession(app.prisma, {
      tenantId: tenant.id,
      minWithdrawable,
      maxWithdrawable,
      defaultDescription
    });
    const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
    const lnurl = buildWithdrawLnurl(origin, session.k1);
    return reply.send({
      k1: session.k1,
      lnurl,
      requestUrl: `${origin}/api/lnurl-withdraw/${session.k1}`,
      expiresAt: session.expiresAt.toISOString()
    });
  });

  app.get('/api/lnurl-withdraw/:k1', async (request, reply) => {
    if (!env.ENABLE_LNURL_WITHDRAW) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const { k1 } = request.params as { k1: string };
    const session = await getWithdrawSession(app.prisma, k1);
    if (!session) {
      return reply.code(404).send({ status: 'ERROR', reason: 'not_found' });
    }
    if (session.status === 'EXPIRED') {
      return reply.code(400).send({ status: 'ERROR', reason: 'expired' });
    }
    const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
    return reply.send(buildWithdrawRequest(origin, session));
  });

  app.get('/api/lnurl-withdraw/callback', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          k1: { type: 'string' },
          pr: { type: 'string' }
        },
        required: ['k1', 'pr'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    if (!env.ENABLE_LNURL_WITHDRAW) {
      return reply.code(404).send({ status: 'ERROR', reason: 'disabled' });
    }
    const { k1, pr } = request.query as { k1: string; pr: string };
    const session = await getWithdrawSession(app.prisma, k1);
    if (!session) {
      return reply.code(404).send({ status: 'ERROR', reason: 'not_found' });
    }
    if (session.status === 'EXPIRED') {
      return reply.code(400).send({ status: 'ERROR', reason: 'expired' });
    }
    if (session.status === 'PAID') {
      return reply.send({ status: 'OK' });
    }

    try {
      await settleWithdrawInvoice(app.prisma, session, pr);
      return reply.send({ status: 'OK' });
    } catch (err) {
      await app.prisma.lnurlWithdrawSession.update({
        where: { k1: session.k1 },
        data: { status: 'FAILED' }
      });
      return reply.code(400).send({ status: 'ERROR', reason: formatWithdrawError(err) });
    }
  });

  app.get('/api/lnurl-withdraw/status/:k1', async (request, reply) => {
    if (!env.ENABLE_LNURL_WITHDRAW) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const { k1 } = request.params as { k1: string };
    const session = await getWithdrawSession(app.prisma, k1);
    if (!session) {
      return reply.code(404).send({ status: 'not_found' });
    }
    return reply.send({
      status: session.status,
      expiresAt: session.expiresAt.toISOString()
    });
  });
}
