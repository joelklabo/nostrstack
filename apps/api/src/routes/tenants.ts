import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

export async function registerTenantRoutes(app: FastifyInstance) {
  app.post('/api/tenants', {
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
    }
  }, async (request, reply) => {
    const body = request.body as { domain: string; displayName: string };

    const tenant = await app.prisma.tenant.create({
      data: {
        domain: body.domain,
        displayName: body.displayName
      }
    });

    return reply.code(201).send({ tenant, publicOrigin: env.PUBLIC_ORIGIN });
  });
}
