import type { FastifyInstance } from 'fastify';
import { env } from './env.js';
import { nostrWellKnown } from './well-known/nostr.js';
import { lnurlpHandler } from './well-known/lnurlp.js';
import { registerTelemetryRoutes } from './telemetry/routes.js';

export function setupRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status: 'ok',
    env: env.NODE_ENV,
    uptime: process.uptime()
  }));

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

  registerTelemetryRoutes(app);
}
