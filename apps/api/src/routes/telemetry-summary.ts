import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { createBitcoindRpcCall, fetchTelemetrySummary, type TelemetrySummary } from '../telemetry/bitcoind.js';
import { telemetrySummaryCounter } from '../telemetry/metrics.js';
import { buildMockSummary } from '../telemetry/mock-summary.js';

const CACHE_TTL_MS = 10_000;

export async function registerTelemetrySummaryRoute(app: FastifyInstance) {
  const { rpcCall } = createBitcoindRpcCall({ rpcUrl: env.BITCOIND_RPC_URL });
  let cachedSummary: TelemetrySummary | null = null;
  let cachedAt = 0;
  let inFlight: Promise<TelemetrySummary> | null = null;

  app.get('/api/telemetry/summary', async (request, reply) => {
    const now = Date.now();
    if (cachedSummary && now - cachedAt < CACHE_TTL_MS) {
      telemetrySummaryCounter.labels('cached').inc();
      return reply.send({ type: 'block', ...cachedSummary });
    }

    if (!inFlight) {
      inFlight = (async () => {
        const heightRaw = await rpcCall('getblockcount');
        const height = Number(heightRaw);
        if (!Number.isFinite(height)) {
          throw new Error('bitcoind returned non-numeric block height');
        }
        const summary = await fetchTelemetrySummary(rpcCall, height, cachedSummary?.time ?? null);
        if (!summary) {
          throw new Error('bitcoind block data unavailable');
        }
        return summary;
      })();
    }

    try {
      const summary = await inFlight;
      cachedSummary = summary;
      cachedAt = Date.now();
      telemetrySummaryCounter.labels('ok').inc();
      return reply.send({ type: 'block', ...summary });
    } catch (err) {
      if (env.NODE_ENV !== 'production') {
        const mockSummary = buildMockSummary({ network: env.BITCOIN_NETWORK });
        cachedSummary = mockSummary;
        cachedAt = Date.now();
        telemetrySummaryCounter.labels('mock').inc();
        app.log.warn({ err }, 'telemetry summary fetch failed, returning mock data');
        return reply.send({ type: 'block', ...mockSummary });
      }
      telemetrySummaryCounter.labels('error').inc();
      app.log.warn({ err }, 'telemetry summary fetch failed');
      return reply.code(502).send({
        error: 'telemetry_unavailable',
        message: 'Telemetry data unavailable.',
        requestId: request.id
      });
    } finally {
      inFlight = null;
    }
  });
}
