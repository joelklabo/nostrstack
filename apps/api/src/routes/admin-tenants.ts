import type { FastifyInstance } from 'fastify';

import { requireAdminKey } from '../plugins/admin-guard.js';

export async function registerAdminTenantRoutes(app: FastifyInstance) {
  // Simple admin bootstrap; later secure with API key/JWT.
  app.post('/api/admin/tenants', {
    schema: {
      body: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          displayName: { type: 'string' }
        },
        required: ['domain', 'displayName'],
        additionalProperties: false
      }
    },
    preHandler: requireAdminKey
  }, async (request, reply) => {
    const body = request.body as { domain: string; displayName: string };
    const tenant = await app.prisma.tenant.upsert({
      where: { domain: body.domain },
      update: { displayName: body.displayName },
      create: { domain: body.domain, displayName: body.displayName }
    });
    return reply.code(201).send(tenant);
  });
}
