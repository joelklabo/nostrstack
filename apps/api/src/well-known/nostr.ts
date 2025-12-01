import type { FastifyReply, FastifyRequest } from 'fastify';

import { getTenantForRequest } from '../tenant-resolver.js';

export async function nostrWellKnown(
  request: FastifyRequest<{ Querystring: { name?: string } }>,
  reply: FastifyReply
) {
  const tenant = await getTenantForRequest(request.server, request);
  const name = (request.query.name || '').toLowerCase();
  const relays = request.server.nostrRelays ?? [];

  // Multi-name support: if name is blank, return all mapped names for this tenant.
  if (!name) {
    const users = await request.server.prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        lightningAddress: { endsWith: `@${tenant.domain}` }
      },
      select: { lightningAddress: true, pubkey: true }
    });
    const names: Record<string, string> = {};
    const relayMap: Record<string, string[]> = {};
    users.forEach((u) => {
      const local = u.lightningAddress?.split('@')[0] || '';
      if (local) {
        const lower = local.toLowerCase();
        names[lower] = u.pubkey;
        if (relays.length) relayMap[lower] = relays;
      }
    });
    return reply.send({ names, relays: relayMap });
  }

  const user = await request.server.prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      lightningAddress: { equals: `${name}@${tenant.domain}` }
    }
  });

  if (!user || !user.pubkey) {
    return reply.code(404).send({ error: 'not found' });
  }

  const payload: { names: Record<string, string>; relays?: Record<string, string[]> } = {
    names: { [name]: user.pubkey }
  };
  if (relays.length) {
    payload.relays = { [name]: relays };
  }
  return reply.send(payload);
}
