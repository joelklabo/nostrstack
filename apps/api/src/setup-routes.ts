import type { FastifyInstance } from 'fastify';

import { env } from './env.js';
import { registerTelemetryRoutes } from './telemetry/routes.js';
import { lnurlpHandler } from './well-known/lnurlp.js';
import { nostrWellKnown } from './well-known/nostr.js';

export function setupRoutes(app: FastifyInstance) {
  const healthHandler = async () => ({
    status: 'ok',
    env: env.NODE_ENV,
    uptime: process.uptime()
  });

  // Expose under both roots: some clients treat "/api" as their base.
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.get('/.well-known/nostr.json', {
    schema: {
      querystring: {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false
      }
    },
    handler: nostrWellKnown
  });

  app.get('/.well-known/lnurlp/:username', {
    schema: {
      params: {
        type: 'object',
        properties: { username: { type: 'string' } },
        required: ['username'],
        additionalProperties: false
      }
    },
    handler: lnurlpHandler
  });

  if (!env.ENABLE_BOLT12) {
    app.addHook('onRequest', async (req, reply) => {
      const url = req.raw.url ?? '';
      if (url.startsWith('/api/bolt12') || url.startsWith('/bolt12')) {
        return reply.status(503).send({
          error: 'bolt12_disabled',
          message: 'BOLT12 is not enabled. Set ENABLE_BOLT12=true to use offers and subscriptions.'
        });
      }
    });
  }

  registerTelemetryRoutes(app);
}
