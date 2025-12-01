import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

export function registerTelemetryRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    const body = await app.metricsRegistry.metrics();
    reply.type('text/plain').send(body);
  });

  app.get('/config/env', async () => ({
    env: env.NODE_ENV,
    publicOrigin: env.PUBLIC_ORIGIN
  }));
}
