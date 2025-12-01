import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

export async function lnurlpHandler(
  request: FastifyRequest<{ Params: { username: string } }>,
  reply: FastifyReply
) {
  const { username } = request.params;
  const tenant = await getTenantForRequest(request.server, request);
  const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
  const callback = `${origin}/api/lnurlp/${encodeURIComponent(username)}/invoice`;

  const identifier = `${username}@${tenant.domain}`;
  const metadata = JSON.stringify([
    ['text/plain', `nostrstack payment to ${identifier}`],
    ['text/identifier', identifier]
  ]);

  const user = await request.server.prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      lightningAddress: { equals: identifier }
    }
  });

  if (!user) {
    return reply.code(404).send({ status: 'not found' });
  }

  return reply.send({
    callback,
    maxSendable: 1_000_000_000, // 1000k sats
    minSendable: 1_000, // 1k msats = 1 sat
    metadata,
    tag: 'payRequest'
  });
}
