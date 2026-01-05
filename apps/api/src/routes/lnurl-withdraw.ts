import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import {
  buildWithdrawLnurl,
  buildWithdrawRequest,
  createWithdrawSession,
  getWithdrawSession,
  normalizeWithdrawBounds,
  parseInvoiceAmountMsat,
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            k1: { type: 'string' },
            lnurl: { type: 'string' },
            requestUrl: { type: 'string' },
            expiresAt: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: { status: { type: 'string' } }
        }
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

  app.get('/api/lnurl-withdraw/:k1', {
    schema: {
      params: {
        type: 'object',
        properties: { k1: { type: 'string' } },
        required: ['k1']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            callback: { type: 'string' },
            k1: { type: 'string' },
            defaultDescription: { type: 'string' },
            minWithdrawable: { type: 'integer' },
            maxWithdrawable: { type: 'integer' }
          }
        },
        400: {
          type: 'object',
          properties: { status: { type: 'string' }, reason: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { status: { type: 'string' }, reason: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
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
      },
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string' } }
        },
        400: {
          type: 'object',
          properties: { status: { type: 'string' }, reason: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { status: { type: 'string' }, reason: { type: 'string' } }
        },
        409: {
          type: 'object',
          properties: { status: { type: 'string' }, reason: { type: 'string' } }
        }
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

    const invoiceAmountMsat = parseInvoiceAmountMsat(pr);
    if (invoiceAmountMsat === null) {
      request.log.warn({ reqId: request.id, k1 }, 'lnurl-withdraw invalid invoice');
      return reply.code(400).send({ status: 'ERROR', reason: 'invalid_invoice' });
    }
    const { minMsat, maxMsat } = normalizeWithdrawBounds(session);
    if (invoiceAmountMsat < minMsat || invoiceAmountMsat > maxMsat) {
      request.log.warn(
        { reqId: request.id, k1, invoiceAmountMsat: invoiceAmountMsat.toString(), minMsat: minMsat.toString(), maxMsat: maxMsat.toString() },
        'lnurl-withdraw invoice amount out of bounds'
      );
      return reply.code(400).send({ status: 'ERROR', reason: 'amount_out_of_bounds' });
    }

    const lockResult = await app.prisma.lnurlWithdrawSession.updateMany({
      where: { k1: session.k1, status: 'PENDING' },
      data: { status: 'PROCESSING' }
    });
    if (lockResult.count === 0) {
      const latest = await getWithdrawSession(app.prisma, k1);
      if (!latest) {
        return reply.code(404).send({ status: 'ERROR', reason: 'not_found' });
      }
      if (latest.status === 'PAID') {
        return reply.send({ status: 'OK' });
      }
      if (latest.status === 'PROCESSING') {
        request.log.info({ reqId: request.id, k1 }, 'lnurl-withdraw already processing');
        return reply.code(409).send({ status: 'ERROR', reason: 'processing' });
      }
      request.log.warn({ reqId: request.id, k1, status: latest.status }, 'lnurl-withdraw not pending');
      return reply.code(400).send({ status: 'ERROR', reason: 'invalid_state' });
    }

    try {
      await settleWithdrawInvoice(app.prisma, session, pr);
      request.log.info(
        { reqId: request.id, k1, invoiceAmountMsat: invoiceAmountMsat.toString() },
        'lnurl-withdraw settled'
      );
      return reply.send({ status: 'OK' });
    } catch (err) {
      await app.prisma.lnurlWithdrawSession.update({
        where: { k1: session.k1 },
        data: { status: 'PENDING' }
      });
      request.log.warn({ reqId: request.id, k1, err }, 'lnurl-withdraw failed');
      return reply.code(400).send({ status: 'ERROR', reason: formatWithdrawError(err) });
    }
  });

  app.get('/api/lnurl-withdraw/status/:k1', {
    schema: {
      params: {
        type: 'object',
        properties: { k1: { type: 'string' } },
        required: ['k1']
      },
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string' }, expiresAt: { type: 'string' } }
        },
        404: {
          type: 'object',
          properties: { status: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
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
