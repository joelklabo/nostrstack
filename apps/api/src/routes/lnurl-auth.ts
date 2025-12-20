import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import {
  buildLnurlAuthCallback,
  createLnurlAuthSession,
  encodeLnurl,
  getLnurlAuthSession,
  verifyLnurlAuthSession
} from '../services/lnurl-auth.js';
import { originFromRequest } from '../tenant-resolver.js';

export async function registerLnurlAuthRoutes(app: FastifyInstance) {
  app.get('/api/lnurl-auth/request', async (request, reply) => {
    if (!env.ENABLE_LNURL_AUTH) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const session = await createLnurlAuthSession(app.prisma);
    const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
    const callback = buildLnurlAuthCallback(origin, session.k1);
    const lnurl = encodeLnurl(callback);

    return reply.send({
      k1: session.k1,
      callback,
      lnurl,
      expiresAt: session.expiresAt.toISOString()
    });
  });

  app.get('/api/lnurl-auth/callback', async (request, reply) => {
    if (!env.ENABLE_LNURL_AUTH) {
      return reply.code(404).send({ status: 'ERROR', reason: 'disabled' });
    }
    const { k1, sig, key } = request.query as Record<string, string | undefined>;
    if (!k1 || !sig || !key) {
      request.log.warn({ reqId: request.id, k1 }, 'lnurl-auth missing params');
      return reply.code(400).send({ status: 'ERROR', reason: 'missing_params' });
    }

    const result = await verifyLnurlAuthSession(app.prisma, { k1, sig, key });
    if (!result.ok) {
      request.log.warn(
        { reqId: request.id, k1, reason: result.reason, keyPrefix: key.slice(0, 12) },
        'lnurl-auth rejected'
      );
      return reply.code(400).send({ status: 'ERROR', reason: result.reason });
    }

    request.log.info(
      { reqId: request.id, k1, keyPrefix: key.slice(0, 12), status: result.session.status },
      'lnurl-auth verified'
    );
    return reply.send({ status: 'OK' });
  });

  app.get('/api/lnurl-auth/status/:k1', async (request, reply) => {
    if (!env.ENABLE_LNURL_AUTH) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const { k1 } = request.params as { k1: string };
    const session = await getLnurlAuthSession(app.prisma, k1);
    if (!session) {
      return reply.code(404).send({ status: 'not_found' });
    }
    return reply.send({
      status: session.status,
      linkingKey: session.linkingKey ?? null,
      expiresAt: session.expiresAt.toISOString()
    });
  });
}
