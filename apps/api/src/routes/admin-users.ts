import type { FastifyInstance } from 'fastify';

import { requireAdminKey } from '../plugins/admin-guard.js';
import { getTenantForRequest } from '../tenant-resolver.js';

export async function registerAdminUserRoutes(app: FastifyInstance) {
  app.post('/api/admin/users', {
    schema: {
      body: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          lightningAddress: { type: 'string' },
          pubkey: { type: 'string' }
        },
        required: ['domain', 'lightningAddress', 'pubkey'],
        additionalProperties: false
      }
    },
    preHandler: requireAdminKey
  }, async (request, reply) => {
    const body = request.body as { domain: string; lightningAddress: string; pubkey: string };
    const tenant = await app.prisma.tenant.upsert({
      where: { domain: body.domain },
      update: {},
      create: { domain: body.domain, displayName: body.domain }
    });

    const user = await app.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: body.pubkey } },
      update: {
        lightningAddress: body.lightningAddress
      },
      create: {
        pubkey: body.pubkey,
        lightningAddress: body.lightningAddress,
        tenantId: tenant.id
      }
    });

    return reply.code(201).send(user);
  });

  // Convenience to list users for the current host (dev use)
  app.get('/api/admin/users', async (request, reply) => {
    const tenant = await getTenantForRequest(app, request);
    const users = await app.prisma.user.findMany({ where: { tenantId: tenant.id } });
    return reply.send(users);
  });
}
