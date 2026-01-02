import type { TelemetrySummary } from './bitcoind.js';

const DEFAULT_TIMEOUT_MS = 5000;

type EsploraBlock = {
  timestamp?: number;
  tx_count?: number;
  size?: number;
  weight?: number;
};

type EsploraMempool = {
  count?: number;
  vsize?: number;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`esplora http ${res.status} ${body}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`esplora timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchText = async (url: string, timeoutMs: number) => {
  const res = await fetchWithTimeout(url, timeoutMs);
  return (await res.text()).trim();
};

const fetchJson = async <T>(url: string, timeoutMs: number): Promise<T> => {
  const res = await fetchWithTimeout(url, timeoutMs);
  return (await res.json()) as T;
};

export async function fetchEsploraTipHeight(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const base = normalizeBaseUrl(baseUrl);
  const heightText = await fetchText(`${base}/blocks/tip/height`, timeoutMs);
  const height = Number(heightText);
  if (!Number.isFinite(height)) {
    throw new Error(`esplora returned non-numeric tip height: ${heightText}`);
  }
  return height;
}

export async function fetchEsploraTipHash(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const base = normalizeBaseUrl(baseUrl);
  const hash = await fetchText(`${base}/blocks/tip/hash`, timeoutMs);
  if (!hash) throw new Error('esplora returned empty tip hash');
  return hash;
}

export async function fetchEsploraBlockHashByHeight(baseUrl: string, height: number, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const base = normalizeBaseUrl(baseUrl);
  const hash = await fetchText(`${base}/block-height/${height}`, timeoutMs);
  if (!hash) throw new Error(`esplora returned empty block hash for height ${height}`);
  return hash;
}

export async function fetchEsploraBlock(baseUrl: string, hash: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const base = normalizeBaseUrl(baseUrl);
  return fetchJson<EsploraBlock>(`${base}/block/${hash}`, timeoutMs);
}

export async function fetchEsploraMempool(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const base = normalizeBaseUrl(baseUrl);
  return fetchJson<EsploraMempool>(`${base}/mempool`, timeoutMs);
}

type EsploraSummaryOptions = {
  baseUrl: string;
  network: string;
  lastBlockTime?: number | null;
  timeoutMs?: number;
};

type EsploraSummaryForHeightOptions = EsploraSummaryOptions & {
  height: number;
};

export async function fetchEsploraSummaryForHeight(options: EsploraSummaryForHeightOptions): Promise<TelemetrySummary> {
  const { baseUrl, network, height } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hash = await fetchEsploraBlockHashByHeight(baseUrl, height, timeoutMs);
  const [block, mempool] = await Promise.all([
    fetchEsploraBlock(baseUrl, hash, timeoutMs),
    fetchEsploraMempool(baseUrl, timeoutMs)
  ]);
  const time = toNumber(block.timestamp) ?? Math.floor(Date.now() / 1000);
  const interval = options.lastBlockTime != null ? Math.max(0, time - options.lastBlockTime) : undefined;

  return {
    height,
    hash,
    time,
    txs: toNumber(block.tx_count),
    size: toNumber(block.size),
    weight: toNumber(block.weight),
    interval,
    mempoolTxs: toNumber(mempool.count),
    mempoolBytes: toNumber(mempool.vsize),
    network,
    headers: height,
    blocks: height,
    verificationProgress: 1,
    initialBlockDownload: false
  };
}

export async function fetchEsploraSummary(options: EsploraSummaryOptions): Promise<TelemetrySummary> {
  const { baseUrl, network } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const [height, tipHash] = await Promise.all([
        fetchEsploraTipHeight(baseUrl, timeoutMs),
        fetchEsploraTipHash(baseUrl, timeoutMs)
      ]);
      const summary = await fetchEsploraSummaryForHeight({
        baseUrl,
        network,
        height,
        lastBlockTime: options.lastBlockTime,
        timeoutMs
      });
      if (tipHash && summary.hash && tipHash !== summary.hash) {
        if (attempt === 0) continue;
        throw new Error('esplora tip hash changed during fetch');
      }
      return summary;
    } catch (err) {
      if (attempt === 0) continue;
      throw err;
    }
  }
  throw new Error('esplora summary fetch failed');
}
