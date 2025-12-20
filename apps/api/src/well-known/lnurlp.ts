import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../env.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

function resolveNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function parseSuccessAction(raw: string | null | undefined) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore invalid successAction
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

  const metadataOverride = user.lnurlMetadata ?? tenant.lnurlMetadata;
  const successActionRaw = user.lnurlSuccessAction ?? tenant.lnurlSuccessAction;
  const successAction = parseSuccessAction(successActionRaw);
  const commentAllowed = resolveNumber(user.lnurlCommentAllowed, tenant.lnurlCommentAllowed);

  return reply.send({
    callback,
    maxSendable: 1_000_000_000, // 1000k sats
    minSendable: 1_000, // 1k msats = 1 sat
    metadata: metadataOverride ?? metadata,
    ...(commentAllowed !== undefined ? { commentAllowed } : {}),
    ...(successAction ? { successAction } : {}),
    tag: 'payRequest'
  });
}
