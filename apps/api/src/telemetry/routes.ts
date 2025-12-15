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

  const lnbitsHealthHandler = async () => {
    if (env.LIGHTNING_PROVIDER !== 'lnbits') {
      return { status: 'skipped', reason: 'provider_not_lnbits' };
    }
    if (!env.LN_BITS_URL) {
      return { status: 'error', error: 'LN_BITS_URL not set' };
    }
    const started = Date.now();
    const base = env.LN_BITS_URL.replace(/\/$/, '');
    const candidates = [`${base}/api/v1/health`, `${base}/status/health`];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        const body = await res.text();
        if (res.ok) {
          return {
            status: 'ok',
            httpStatus: res.status,
            elapsedMs: Date.now() - started,
            body: body.slice(0, 200),
            urlTried: url
          };
        }
      } catch (err) {
        // try next candidate
      }
    }
    return {
      status: 'fail',
      error: 'health endpoint not reachable',
      elapsedMs: Date.now() - started
    };
  };

  // Expose under both roots: some clients treat "/api" as their base.
  app.get('/health/lnbits', lnbitsHealthHandler);
  app.get('/api/health/lnbits', lnbitsHealthHandler);
}
