import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveApiBase } from '../api-base';
import { useNostrstackConfig } from '../context';

export type TelemetrySource = 'bitcoind' | 'esplora' | 'mock';

export type TelemetrySummary = {
  height: number;
  hash: string;
  time: number;
  txs?: number;
  size?: number;
  weight?: number;
  interval?: number;
  mempoolTxs?: number;
  mempoolBytes?: number;
  network?: string;
  version?: number;
  subversion?: string;
  connections?: number;
  headers?: number;
  blocks?: number;
  verificationProgress?: number;
  initialBlockDownload?: boolean;
};

export type LnbitsHealth =
  | { status: 'skipped'; reason: 'provider_not_lnbits' }
  | { status: 'error'; error: 'LN_BITS_URL not set' }
  | { status: 'ok'; httpStatus: number; elapsedMs: number; body: string; urlTried: string }
  | { status: 'fail'; error: 'health endpoint not reachable'; elapsedMs: number };

export type BitcoinStatus = {
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

export type BitcoinStatusState = {
  status: BitcoinStatus | null;
  error: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  refresh: () => void;
};

const STATUS_CACHE_TTL_MS = 10_000;

type CacheEntry = {
  data?: BitcoinStatus;
  fetchedAt?: number;
  promise?: Promise<BitcoinStatus>;
};

const statusCache = new Map<string, CacheEntry>();

function readCachedStatus(cacheKey: string): BitcoinStatus | null {
  const entry = statusCache.get(cacheKey);
  if (!entry?.data || !entry.fetchedAt) return null;
  if (Date.now() - entry.fetchedAt > STATUS_CACHE_TTL_MS) return null;
  return entry.data;
}

async function fetchBitcoinStatus(baseUrl: string): Promise<BitcoinStatus> {
  const url = baseUrl ? `${baseUrl}/api/bitcoin/status` : '/api/bitcoin/status';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text ? `HTTP ${res.status}: ${text}` : `HTTP ${res.status}`);
  }
  return (await res.json()) as BitcoinStatus;
}

async function fetchBitcoinStatusCached(cacheKey: string, baseUrl: string): Promise<BitcoinStatus> {
  const existing = statusCache.get(cacheKey);
  if (existing?.promise) return existing.promise;

  const previousData = existing?.data;
  const previousFetchedAt = existing?.fetchedAt;
  const promise = fetchBitcoinStatus(baseUrl);
  statusCache.set(cacheKey, { ...existing, promise });

  try {
    const data = await promise;
    statusCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    if (previousData) {
      statusCache.set(cacheKey, { data: previousData, fetchedAt: previousFetchedAt });
    } else {
      statusCache.delete(cacheKey);
    }
    throw err;
  } finally {
    const current = statusCache.get(cacheKey);
    if (current?.promise === promise) {
      statusCache.delete(cacheKey);
      if (previousData) {
        statusCache.set(cacheKey, { data: previousData, fetchedAt: previousFetchedAt });
      }
    }
  }
}

export function useBitcoinStatus(apiBase?: string): BitcoinStatusState {
  const cfg = useNostrstackConfig();
  const apiBaseRaw = apiBase ?? cfg.apiBase ?? cfg.baseUrl ?? '';
  const apiBaseConfig = useMemo(
    () => cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw),
    [cfg.apiBaseConfig, apiBaseRaw]
  );
  const cacheKey = apiBaseConfig.isConfigured
    ? apiBaseConfig.isRelative
      ? 'relative'
      : apiBaseConfig.baseUrl
    : '';
  const [status, setStatus] = useState<BitcoinStatus | null>(() =>
    cacheKey ? readCachedStatus(cacheKey) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(apiBaseConfig.isConfigured && !status);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(window.navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refresh = useCallback(() => {
    if (!cacheKey) return;
    statusCache.delete(cacheKey);
    setRefreshToken((prev) => prev + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (!apiBaseConfig.isConfigured) {
      setStatus(null);
      setIsLoading(false);
      setError(apiBaseConfig.isMock ? 'API base is mock.' : 'API base not configured.');
      return;
    }
    if (!isOnline) {
      setIsLoading(false);
      setError('Bitcoin status updates are paused while offline.');
      return;
    }

    const cached = cacheKey ? readCachedStatus(cacheKey) : null;
    if (cached && refreshToken === 0) {
      setStatus(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const baseUrl = apiBaseConfig.isRelative ? '' : apiBaseConfig.baseUrl;
    fetchBitcoinStatusCached(cacheKey, baseUrl)
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const rawMessage = err instanceof Error ? err.message : 'Bitcoin status unavailable.';
        const message = /^HTTP\s+\d+:/.test(rawMessage)
          ? `Bitcoin status unavailable. ${rawMessage}`
          : rawMessage;
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiBaseConfig.baseUrl,
    apiBaseConfig.isConfigured,
    apiBaseConfig.isMock,
    apiBaseConfig.isRelative,
    cacheKey,
    refreshToken,
    isOnline
  ]);

  return {
    status,
    error,
    isLoading,
    isConfigured: apiBaseConfig.isConfigured,
    refresh
  };
}
