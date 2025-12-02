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

  app.get('/health/lnbits', async () => {
    if (env.LIGHTNING_PROVIDER !== 'lnbits') {
      return { status: 'skipped', reason: 'provider_not_lnbits' };
    }
    if (!env.LN_BITS_URL) {
      return { status: 'error', error: 'LN_BITS_URL not set' };
    }
    const started = Date.now();
    try {
      const res = await fetch(`${env.LN_BITS_URL.replace(/\/$/, '')}/status/health`);
      const body = await res.text();
      return {
        status: res.ok ? 'ok' : 'fail',
        httpStatus: res.status,
        elapsedMs: Date.now() - started,
        body: body.slice(0, 200)
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', error: msg, elapsedMs: Date.now() - started };
    }
  });
}
