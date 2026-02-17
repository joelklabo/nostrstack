import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../env.js';
import { normalizeLnurlMetadata, parseLnurlSuccessAction } from '../services/lnurl-pay.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

function resolveNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

export async function lnurlpHandler(
  request: FastifyRequest<{ Params: { username: string } }>,
  reply: FastifyReply
) {
  const { username } = request.params;
  const tenant = await getTenantForRequest(request.server, request);
  const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
  const localUsername = username.includes('@') ? username.split('@', 1)[0] : username;
  if (localUsername !== username) {
    request.log.warn(
      { username, tenant: tenant.domain },
      'lnurlp metadata username included domain; normalizing to local part'
    );
  }

  const callback = `${origin}/api/lnurlp/${encodeURIComponent(localUsername)}/invoice`;
  const identifier = `${localUsername}@${tenant.domain}`;
  const metadata = JSON.stringify([
    ['text/plain', `nostrstack payment to ${identifier}`],
    ['text/identifier', identifier]
  ]);

  const user = await request.server.prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      lightningAddress: { equals: identifier, mode: 'insensitive' }
    }
  });

  if (!user) {
    request.log.warn(
      { username, tenant: tenant.domain, status: 'not_found' },
      'lnurlp metadata lookup did not find user'
    );
    return reply.code(404).send({ status: 'not found' });
  }

  const metadataRaw = user.lnurlMetadata ?? tenant.lnurlMetadata ?? metadata;
  const metadataResult = normalizeLnurlMetadata(metadataRaw);
  if (metadataResult.error) {
    request.log.warn(
      { username, tenant: tenant.domain, reason: metadataResult.error },
      'invalid lnurl metadata'
    );
    return reply.code(400).send({ status: 'ERROR', reason: metadataResult.error });
  }

  const successActionRaw = user.lnurlSuccessAction ?? tenant.lnurlSuccessAction;
  const successActionResult = parseLnurlSuccessAction(successActionRaw);
  if (successActionResult.error) {
    request.log.warn(
      { username, tenant: tenant.domain, reason: successActionResult.error },
      'invalid lnurl successAction'
    );
    return reply.code(400).send({ status: 'ERROR', reason: successActionResult.error });
  }
  const successAction = successActionResult.value;
  const commentAllowed = resolveNumber(user.lnurlCommentAllowed, tenant.lnurlCommentAllowed);

  return reply.send({
    callback,
    maxSendable: 1_000_000_000, // 1000k sats
    minSendable: 1_000, // 1k msats = 1 sat
    metadata: metadataResult.value ?? metadata,
    ...(commentAllowed !== undefined ? { commentAllowed } : {}),
    ...(successAction ? { successAction } : {}),
    tag: 'payRequest'
  });
}
