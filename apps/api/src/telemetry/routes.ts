import type { FastifyInstance, FastifyReply } from 'fastify';

import { env } from '../env.js';
import { type TelemetrySource, type TelemetrySummary } from './bitcoind.js';
import { bitcoinStatusFailureCounter, bitcoinStatusFetchDuration, bitcoinStatusRequestCounter } from './metrics.js';
import { createTelemetryFetcher } from './providers.js';

type LnbitsHealth =
  | { status: 'skipped'; reason: 'provider_not_lnbits' }
  | { status: 'error'; error: 'LN_BITS_URL not set' }
  | { status: 'ok'; httpStatus: number; elapsedMs: number; body: string; urlTried: string }
  | { status: 'fail'; error: 'health endpoint not reachable'; elapsedMs: number };

type BitcoinStatus = {
  network: string;
  configuredNetwork: string;
  source: TelemetrySource;
  telemetry: TelemetrySummary;
  telemetryError?: string;
  lightning: {
    provider: string;
    lnbits: LnbitsHealth;
  };
};

type TelemetryFetchResult = {
  source: TelemetrySource;
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
      } catch {
        // try next candidate
      }
    }
    return {
      status: 'fail',
      error: 'health endpoint not reachable',
      elapsedMs: Date.now() - started
    };
  };

  const telemetryFetcher = createTelemetryFetcher();
  const fetchTelemetry = async (): Promise<TelemetryFetchResult> => telemetryFetcher.fetchSummaryWithFallback();

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

  const handleBitcoinStatusRequest = async (reply: FastifyReply) => {
    const started = Date.now();
    let source: TelemetrySource | 'unknown' = 'unknown';
    try {
      const status = await bitcoinStatusHandler();
      source = status.source;
      const elapsedSeconds = (Date.now() - started) / 1000;
      bitcoinStatusRequestCounter.labels('ok', source).inc();
      bitcoinStatusFetchDuration.labels('ok', source).observe(elapsedSeconds);
      if (status.telemetryError) {
        bitcoinStatusFailureCounter.labels('telemetry_error').inc();
      }
      if (status.lightning.lnbits.status === 'error') {
        bitcoinStatusFailureCounter.labels('lnbits_config').inc();
      } else if (status.lightning.lnbits.status === 'fail') {
        bitcoinStatusFailureCounter.labels('lnbits_unreachable').inc();
      }
      return reply.send(status);
    } catch (err) {
      const elapsedSeconds = (Date.now() - started) / 1000;
      bitcoinStatusRequestCounter.labels('error', source).inc();
      bitcoinStatusFetchDuration.labels('error', source).observe(elapsedSeconds);
      bitcoinStatusFailureCounter.labels('handler_exception').inc();
      app.log.warn({ err }, 'bitcoin status failed');
      return reply.status(502).send({
        error: 'bitcoin_status_unavailable',
        message: 'Bitcoin status unavailable.'
      });
    }
  };

  app.get('/bitcoin/status', async (_req, reply) => handleBitcoinStatusRequest(reply));
  app.get('/api/bitcoin/status', async (_req, reply) => handleBitcoinStatusRequest(reply));
}
