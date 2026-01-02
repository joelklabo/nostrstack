import { env } from '../env.js';
import { createBitcoindRpcCall, fetchTelemetrySummary, type TelemetrySource, type TelemetrySummary } from './bitcoind.js';
import { fetchEsploraSummary, fetchEsploraSummaryForHeight, fetchEsploraTipHeight } from './esplora.js';
import { buildMockSummary } from './mock-summary.js';

export type TelemetryProvider = {
  source: TelemetrySource;
  fetchTipHeight: () => Promise<number>;
  fetchSummaryForHeight: (height: number, lastBlockTime?: number | null) => Promise<TelemetrySummary>;
  fetchSummary: (lastBlockTime?: number | null) => Promise<TelemetrySummary>;
};

export type TelemetryFetchResult = {
  source: TelemetrySource;
  summary: TelemetrySummary;
  error?: string;
  cached?: boolean;
};

const createBitcoindProvider = (): TelemetryProvider => {
  const { rpcCall } = createBitcoindRpcCall({ rpcUrl: env.BITCOIND_RPC_URL });

  const fetchTipHeight = async () => {
    const heightRaw = await rpcCall('getblockcount');
    const height = Number(heightRaw);
    if (!Number.isFinite(height)) {
      throw new Error('bitcoind returned non-numeric block height');
    }
    return height;
  };

  const fetchSummaryForHeight = async (height: number, lastBlockTime?: number | null) => {
    const summary = await fetchTelemetrySummary(rpcCall, height, lastBlockTime ?? null);
    if (!summary) {
      throw new Error('bitcoind block data unavailable');
    }
    return summary;
  };

  const fetchSummary = async (lastBlockTime?: number | null) => fetchSummaryForHeight(await fetchTipHeight(), lastBlockTime);

  return {
    source: 'bitcoind',
    fetchTipHeight,
    fetchSummaryForHeight,
    fetchSummary
  };
};

const createEsploraProvider = (): TelemetryProvider => {
  const baseUrl = env.TELEMETRY_ESPLORA_URL;
  if (!baseUrl) {
    throw new Error('TELEMETRY_ESPLORA_URL is required when TELEMETRY_PROVIDER=esplora');
  }
  const fetchTipHeight = () => fetchEsploraTipHeight(baseUrl);
  const fetchSummaryForHeight = (height: number, lastBlockTime?: number | null) =>
    fetchEsploraSummaryForHeight({
      baseUrl,
      network: env.BITCOIN_NETWORK,
      height,
      lastBlockTime
    });
  const fetchSummary = (lastBlockTime?: number | null) =>
    fetchEsploraSummary({
      baseUrl,
      network: env.BITCOIN_NETWORK,
      lastBlockTime
    });

  return {
    source: 'esplora',
    fetchTipHeight,
    fetchSummaryForHeight,
    fetchSummary
  };
};

const createMockProvider = (): TelemetryProvider => {
  const fetchSummary = async () => buildMockSummary({ network: env.BITCOIN_NETWORK });
  const fetchTipHeight = async () => {
    const summary = await fetchSummary();
    return summary.height;
  };
  const fetchSummaryForHeight = async (_height: number, _lastBlockTime?: number | null) => fetchSummary();

  return {
    source: 'mock',
    fetchTipHeight,
    fetchSummaryForHeight,
    fetchSummary
  };
};

export const getTelemetryProvider = (): TelemetryProvider => {
  switch (env.TELEMETRY_PROVIDER) {
    case 'mock':
      return createMockProvider();
    case 'esplora':
      return createEsploraProvider();
    case 'bitcoind':
    default:
      return createBitcoindProvider();
  }
};

type TelemetryFetcherOptions = {
  cacheTtlMs?: number;
};

export const createTelemetryFetcher = (options: TelemetryFetcherOptions = {}) => {
  const provider = getTelemetryProvider();
  const cacheTtlMs = options.cacheTtlMs ?? 10_000;
  let cachedSummary: TelemetrySummary | null = null;
  let cachedAt = 0;
  let inFlight: Promise<TelemetrySummary> | null = null;

  const fetchSummaryCached = async (lastBlockTime?: number | null) => {
    const now = Date.now();
    if (cachedSummary && now - cachedAt < cacheTtlMs) {
      return { summary: cachedSummary, cached: true };
    }
    if (!inFlight) {
      inFlight = provider.fetchSummary(lastBlockTime ?? cachedSummary?.time ?? null);
    }
    try {
      const summary = await inFlight;
      cachedSummary = summary;
      cachedAt = Date.now();
      return { summary, cached: false };
    } finally {
      inFlight = null;
    }
  };

  const fetchSummaryWithFallback = async (lastBlockTime?: number | null): Promise<TelemetryFetchResult> => {
    try {
      const { summary, cached } = await fetchSummaryCached(lastBlockTime);
      return { source: provider.source, summary, cached };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (env.NODE_ENV !== 'production') {
        const summary = buildMockSummary({ network: env.BITCOIN_NETWORK });
        cachedSummary = summary;
        cachedAt = Date.now();
        return { source: 'mock', summary, error: msg, cached: false };
      }
      throw err;
    }
  };

  return {
    provider,
    fetchTipHeight: provider.fetchTipHeight,
    fetchSummary: provider.fetchSummary,
    fetchSummaryForHeight: provider.fetchSummaryForHeight,
    fetchSummaryCached,
    fetchSummaryWithFallback
  };
};
