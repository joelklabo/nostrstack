import type { FastifyInstance } from 'fastify';

import { telemetrySummaryCounter } from '../telemetry/metrics.js';
import { createTelemetryFetcher } from '../telemetry/providers.js';

const CACHE_TTL_MS = 10_000;

export async function registerTelemetrySummaryRoute(app: FastifyInstance) {
  const telemetryFetcher = createTelemetryFetcher({ cacheTtlMs: CACHE_TTL_MS });

  app.get('/api/telemetry/summary', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
          properties: {
            type: { type: 'string' },
            source: { type: 'string' },
            height: { type: 'integer' },
            hash: { type: 'string' },
            time: { type: 'integer' },
            txs: { type: 'integer' },
            size: { type: 'integer' },
            weight: { type: 'integer' },
            interval: { type: 'integer' },
            mempoolTxs: { type: 'integer' },
            mempoolBytes: { type: 'integer' },
            network: { type: 'string' },
            version: { type: 'integer' },
            subversion: { type: 'string' },
            connections: { type: 'integer' },
            headers: { type: 'integer' },
            blocks: { type: 'integer' },
            verificationProgress: { type: 'number' },
            initialBlockDownload: { type: 'boolean' }
          }
        },
        502: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            requestId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await telemetryFetcher.fetchSummaryWithFallback();
      if (result.cached) {
        telemetrySummaryCounter.labels('cached').inc();
      } else if (result.source === 'mock') {
        telemetrySummaryCounter.labels('mock').inc();
      } else {
        telemetrySummaryCounter.labels('ok').inc();
      }
      if (result.source === 'mock' && result.error) {
        app.log.warn({ err: result.error }, 'telemetry summary fetch failed, returning mock data');
      }
      return reply.send({ type: 'block', source: result.source, ...result.summary });
    } catch (err) {
      telemetrySummaryCounter.labels('error').inc();
      app.log.warn({ err }, 'telemetry summary fetch failed');
      return reply.code(502).send({
        error: 'telemetry_unavailable',
        message: 'Telemetry data unavailable.',
        requestId: request.id
      });
    }
  });
}
