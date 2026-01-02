import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { createBitcoindRpcCall, fetchTelemetrySummary, type TelemetrySummary } from './bitcoind.js';
import { buildMockSummary } from './mock-summary.js';

type LnbitsHealth =
  | { status: 'skipped'; reason: 'provider_not_lnbits' }
  | { status: 'error'; error: 'LN_BITS_URL not set' }
  | { status: 'ok'; httpStatus: number; elapsedMs: number; body: string; urlTried: string }
  | { status: 'fail'; error: 'health endpoint not reachable'; elapsedMs: number };

type BitcoinStatus = {
  network: string;
  configuredNetwork: string;
  source: 'bitcoind' | 'mock';
  telemetry: TelemetrySummary;
  telemetryError?: string;
  lightning: {
    provider: string;
    lnbits: LnbitsHealth;
  };
};

type TelemetryFetchResult = {
  source: 'bitcoind' | 'mock';
  summary: TelemetrySummary;
  error?: string;
};

export function registerTelemetryRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    const body = await app.metricsRegistry.metrics();
    reply.type('text/plain').send(body);
  });

  app.get('/config/env', async () => ({
    env: env.NODE_ENV,
    publicOrigin: env.PUBLIC_ORIGIN
  }));

  const lnbitsHealthHandler = async (): Promise<LnbitsHealth> => {
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

  const fetchTelemetry = async (): Promise<TelemetryFetchResult> => {
    if (env.TELEMETRY_PROVIDER === 'mock') {
      return { source: 'mock', summary: buildMockSummary({ network: env.BITCOIN_NETWORK }) };
    }
    const { rpcCall } = createBitcoindRpcCall({ rpcUrl: env.BITCOIND_RPC_URL });
    try {
      const heightRaw = await rpcCall('getblockcount');
      const height = Number(heightRaw);
      if (!Number.isFinite(height)) {
        throw new Error('bitcoind returned non-numeric block height');
      }
      const summary = await fetchTelemetrySummary(rpcCall, height, null);
      if (!summary) {
        throw new Error('bitcoind block data unavailable');
      }
      return { source: 'bitcoind', summary };
    } catch (err) {
      if (env.NODE_ENV !== 'production') {
        const summary = buildMockSummary({ network: env.BITCOIN_NETWORK });
        const msg = err instanceof Error ? err.message : String(err);
        return { source: 'mock', summary, error: msg };
      }
      throw err;
    }
  };

  // Expose under both roots: some clients treat "/api" as their base.
  app.get('/health/lnbits', lnbitsHealthHandler);
  app.get('/api/health/lnbits', lnbitsHealthHandler);

  const bitcoinStatusHandler = async (): Promise<BitcoinStatus> => {
    const telemetry = await fetchTelemetry();
    const lnbits = await lnbitsHealthHandler();
    const network = telemetry.summary.network || env.BITCOIN_NETWORK;
    return {
      network,
      configuredNetwork: env.BITCOIN_NETWORK,
      source: telemetry.source,
      telemetry: telemetry.summary,
      telemetryError: telemetry.error,
      lightning: {
        provider: env.LIGHTNING_PROVIDER,
        lnbits
      }
    };
  };

  app.get('/bitcoin/status', async (_req, reply) => {
    try {
      return reply.send(await bitcoinStatusHandler());
    } catch (err) {
      app.log.warn({ err }, 'bitcoin status failed');
      return reply.status(502).send({
        error: 'bitcoin_status_unavailable',
        message: 'Bitcoin status unavailable.'
      });
    }
  });
  app.get('/api/bitcoin/status', async (_req, reply) => {
    try {
      return reply.send(await bitcoinStatusHandler());
    } catch (err) {
      app.log.warn({ err }, 'bitcoin status failed');
      return reply.status(502).send({
        error: 'bitcoin_status_unavailable',
        message: 'Bitcoin status unavailable.'
      });
    }
  });
}
