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
          properties: {
            type: { type: 'string' },
            source: { type: 'string' },
            blockHeight: { type: 'integer' },
            blockHash: { type: 'string' },
            timestamp: { type: 'integer' },
            difficulty: { type: 'number' },
            mempoolSize: { type: 'integer' },
            feeRates: {
              type: 'object',
              properties: {
                fastestFee: { type: 'number' },
                halfHourFee: { type: 'number' },
                hourFee: { type: 'number' },
                economyFee: { type: 'number' },
                minimumFee: { type: 'number' }
              }
            }
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
