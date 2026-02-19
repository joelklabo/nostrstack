import { parseRelays } from '@nostrstack/react';
import type { Event, SimplePool } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';

import type { ProfileMeta } from './eventRenderers';
import { relayMonitor } from './relayHealth';

export type ApiNostrTarget = {
  input: string;
  type: 'event' | 'profile' | 'address';
  relays?: string[];
  id?: string;
  pubkey?: string;
  kind?: number;
  identifier?: string;
};

export type ApiNostrReferences = {
  root: string[];
  reply: string[];
  mention: string[];
  quote: string[];
  address: string[];
  profiles: string[];
};

export type ApiReplyPage = {
  hasMore: boolean;
  nextCursor?: string | null;
};

export type ApiNostrEventResponse = {
  target: ApiNostrTarget;
  event: Event;
  author: {
    pubkey: string;
    profile: ProfileMeta | null;
  };
  references: ApiNostrReferences;
  replyThreadId?: string;
  replies?: Event[];
  replyPage?: ApiReplyPage;
};

export const SEARCH_RELAYS = ['wss://relay.snort.social'];
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const EVENT_FETCH_TTL_MS = 30_000;
const EVENT_FETCH_BASE_RETRY_MS = 1_000;
const EVENT_FETCH_MAX_RETRY_MS = 30_000;
const MAX_EVENT_FETCH_ENTRIES = 250;
export const NOTES_SEARCH_TIMEOUT_MS = 30_000;
const SEARCH_RELAY_TIMEOUT_MS = Math.min(NOTES_SEARCH_TIMEOUT_MS, 10_000);
const SEARCH_UNSUPPORTED_RELAY_HOSTS = new Set(['relay.damus.io', 'nos.lol', 'relay.primal.net']);

type NostrEventCacheEntry = {
  data?: ApiNostrEventResponse;
  error?: string;
  retryAtMs: number;
  failCount: number;
  resolvedAtMs?: number;
  inFlight?: Promise<ApiNostrEventResponse>;
};

const eventResponseCache = new Map<string, NostrEventCacheEntry>();

function parseRetryAfterSeconds(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

function pruneEventFetchCache(now: number) {
  if (eventResponseCache.size <= MAX_EVENT_FETCH_ENTRIES) return;
  for (const [key, entry] of eventResponseCache) {
    if (entry.inFlight) continue;
    if (entry.data && entry.resolvedAtMs && now - entry.resolvedAtMs > EVENT_FETCH_TTL_MS) {
      eventResponseCache.delete(key);
      continue;
    }
    if (entry.error && now - (entry.resolvedAtMs ?? 0) > EVENT_FETCH_TTL_MS) {
      eventResponseCache.delete(key);
    }
    if (eventResponseCache.size <= MAX_EVENT_FETCH_ENTRIES) break;
  }
}

function normalizeApiEventBase(baseUrl: string) {
  const trimmed = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  if (!trimmed) return '';
  if (trimmed === '/api' || /\/api$/.test(trimmed)) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

function normalizeRelayList(relays: string[]): string[] {
  const cleaned = relays
    .map((relay) => relay.trim())
    .filter(Boolean)
    .map((relay) => {
      try {
        return normalizeURL(relay);
      } catch {
        return null;
      }
    })
    .filter((relay): relay is string => Boolean(relay));
  return Array.from(new Set(cleaned));
}

export function getDefaultRelays(raw?: string | null): string[] {
  const parsed = parseRelays(raw);
  const base = parsed.length ? parsed : DEFAULT_RELAYS;
  const normalized = normalizeRelayList(base);

  return normalized.filter((url) => relayMonitor.isHealthy(url));
}

export function getSearchRelays(rawRelays: string[] = []): string[] {
  const merged = normalizeRelayList([...rawRelays, ...SEARCH_RELAYS]).filter((relay) => {
    try {
      const { hostname } = new URL(relay);
      return !SEARCH_UNSUPPORTED_RELAY_HOSTS.has(hostname.toLowerCase());
    } catch {
      return true;
    }
  });
  return merged.filter((relay) => relayMonitor.isHealthy(relay));
}

export function markRelayFailure(relay: string) {
  relayMonitor.reportFailure(relay);
}

type ApiErrorResponse = {
  error?: string;
  message?: string;
  requestId?: string;
};

type FetchOptions = {
  baseUrl: string;
  id: string;
  relays?: string[];
  limitRefs?: number;
  timeoutMs?: number;
  replyLimit?: number;
  replyCursor?: string;
  replyTimeoutMs?: number;
  signal?: AbortSignal;
};

function buildNostrEventUrl(
  baseUrl: string,
  id: string,
  params: {
    relays?: string[];
    limitRefs?: number;
    timeoutMs?: number;
    replyLimit?: number;
    replyCursor?: string;
    replyTimeoutMs?: number;
  } = {}
) {
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const query = new URLSearchParams();
  if (params.relays?.length) query.set('relays', params.relays.join(','));
  if (params.limitRefs != null) query.set('limitRefs', String(params.limitRefs));
  if (params.timeoutMs != null) query.set('timeoutMs', String(params.timeoutMs));
  if (params.replyLimit != null) query.set('replyLimit', String(params.replyLimit));
  if (params.replyCursor) query.set('replyCursor', params.replyCursor);
  if (params.replyTimeoutMs != null) query.set('replyTimeoutMs', String(params.replyTimeoutMs));
  const suffix = query.toString();
  const normalizedBase = normalizeApiEventBase(base);
  return `${normalizedBase}/api/nostr/event/${encodeURIComponent(id)}${suffix ? `?${suffix}` : ''}`;
}

function parseApiError(bodyText: string, status: number) {
  if (status === 429) {
    return 'Rate limited. Please wait a moment and try again.';
  }
  let message = bodyText || `HTTP ${status}`;
  let requestId: string | undefined;
  let isClientValidation = status >= 400 && status < 500;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as ApiErrorResponse;
      message = parsed.message || parsed.error || message;
      requestId = parsed.requestId;
      if (parsed.error) {
        isClientValidation =
          isClientValidation ||
          parsed.error.startsWith('invalid_') ||
          parsed.error.startsWith('malformed_');
      }
    } catch {
      // ignore parse failures
    }
  }
  if (requestId) {
    const source = isClientValidation ? 'client_validation' : 'backend';
    return `${message} [${source}; requestId=${requestId}]`;
  }
  return message;
}

export async function fetchNostrEventFromApi(
  options: FetchOptions
): Promise<ApiNostrEventResponse> {
  const url = buildNostrEventUrl(options.baseUrl, options.id, {
    relays: options.relays,
    limitRefs: options.limitRefs,
    timeoutMs: options.timeoutMs,
    replyLimit: options.replyLimit,
    replyCursor: options.replyCursor,
    replyTimeoutMs: options.replyTimeoutMs
  });

  const now = Date.now();
  const cached = eventResponseCache.get(url);
  if (cached?.data && cached.resolvedAtMs && now - cached.resolvedAtMs < EVENT_FETCH_TTL_MS) {
    return cached.data;
  }
  if (cached?.inFlight) {
    return cached.inFlight;
  }

  const failCount = cached?.failCount ?? 0;
  const request = (async () => {
    const res = await fetch(url, {
      signal: options.signal,
      headers: { Accept: 'application/json' }
    });
    const bodyText = await res.text();
    if (!res.ok) {
      const error = new Error(parseApiError(bodyText, res.status));
      const status = res.status;
      (error as { status?: number }).status = status;
      const retryAfter = parseRetryAfterSeconds(res.headers.get('Retry-After'));
      (error as { retryAfterMs?: number }).retryAfterMs = retryAfter ?? undefined;
      throw error;
    }
    if (!bodyText) {
      throw new Error('Empty API response.');
    }
    const data = JSON.parse(bodyText) as ApiNostrEventResponse;
    if (!data?.event || !data?.target) {
      throw new Error('Invalid API response.');
    }
    return data;
  })();

  eventResponseCache.set(url, {
    ...cached,
    inFlight: request,
    failCount,
    retryAtMs: 0
  });
  pruneEventFetchCache(now);

  try {
    const data = await request;
    eventResponseCache.set(url, {
      data,
      failCount: 0,
      error: undefined,
      retryAtMs: 0,
      resolvedAtMs: Date.now(),
      inFlight: undefined
    });
    return data;
  } catch (err) {
    const parsed = err as { status?: number; retryAfterMs?: number };
    const retryDelayMs = (() => {
      if (parsed.retryAfterMs && parsed.retryAfterMs > 0) return parsed.retryAfterMs;
      if (parsed.status === 404)
        return Math.min(EVENT_FETCH_MAX_RETRY_MS, EVENT_FETCH_BASE_RETRY_MS * 2 ** failCount);
      return Math.min(
        EVENT_FETCH_MAX_RETRY_MS,
        EVENT_FETCH_BASE_RETRY_MS * 2 ** Math.min(failCount, 12)
      );
    })();
    const message = err instanceof Error ? err.message : 'Failed to load event.';
    eventResponseCache.set(url, {
      error: message,
      failCount: failCount + 1,
      retryAtMs: Date.now() + retryDelayMs,
      resolvedAtMs: Date.now()
    });
    throw err;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const directMessage = record.message;
    if (typeof directMessage === 'string') return directMessage;
    if (directMessage instanceof Error) return directMessage.message;
    const reason = record.reason;
    if (typeof reason === 'string') return reason;
    if (reason instanceof Error) return reason.message;
    const nestedError = record.error;
    if (typeof nestedError === 'string') return nestedError;
    if (nestedError instanceof Error) return nestedError.message;
  }
  return String(error);
}

export async function searchNotes(
  pool: SimplePool,
  relays: string[],
  query: string,
  limit = 20,
  until?: number
): Promise<Event[]> {
  try {
    if (!relays.length) return [];

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
    const normalizedUntil =
      typeof until === 'number' && Number.isInteger(until) ? until : undefined;
    const quoted = trimmedQuery.toLowerCase();
    const fallbackLimit = Math.max(1, Math.min(normalizedLimit * 2, 100));
    const isSearchUnsupportedError = (error: unknown): boolean => {
      const message = getErrorMessage(error);
      const lower = message.toLowerCase();
      return lower.includes('unrecognized filter') || lower.includes('unrecognised filter');
    };
    const isTimeoutError = (error: unknown): boolean => {
      const message = getErrorMessage(error);
      const lower = message.toLowerCase();
      return lower.includes('timeout') || lower.includes('timed out');
    };
    const isNetworkError = (error: unknown): boolean => {
      const message = getErrorMessage(error);
      const lower = message.toLowerCase();
      return (
        lower.includes('failed to fetch') ||
        lower.includes('network error') ||
        lower.includes('dns') ||
        lower.includes('econnrefused') ||
        lower.includes('connection refused') ||
        lower.includes('connection failed') ||
        lower.includes('socket') ||
        lower.includes('enotfound') ||
        lower.includes('etimedout')
      );
    };

    const runQuery = async (
      withSearch: boolean
    ): Promise<{
      merged: Map<string, Event>;
      failures: unknown[];
      successCount: number;
    }> => {
      const filter: { kinds: number[]; search?: string; limit: number; until?: number } = {
        kinds: [1],
        limit: withSearch ? normalizedLimit : fallbackLimit
      };
      if (withSearch) {
        filter.search = trimmedQuery;
      }
      if (normalizedUntil) {
        filter.until = normalizedUntil;
      }

      const merged = new Map<string, Event>();
      const failures: unknown[] = [];
      let successCount = 0;

      const relayPromises = relays.map((relay) => {
        return withTimeout(
          pool.querySync([relay], filter, { maxWait: SEARCH_RELAY_TIMEOUT_MS }),
          SEARCH_RELAY_TIMEOUT_MS
        );
      });

      for (let i = 0; i < relayPromises.length; i++) {
        try {
          const result = await relayPromises[i];
          successCount++;
          for (const event of result) {
            merged.set(event.id, event);
          }
          const hasEnoughResults = merged.size >= normalizedLimit;
          const hasMultipleSuccesses = successCount >= 2;
          if (hasEnoughResults && hasMultipleSuccesses) {
            break;
          }
        } catch (error) {
          const relay = relays[i];
          failures.push(error);
          if (!isSearchUnsupportedError(error)) {
            markRelayFailure(relay);
          }
        }
      }

      return { merged, failures, successCount };
    };

    const primary = await runQuery(true);
    const primaryFailures = primary.failures;
    const hasSearchUnsupportedFailure = primaryFailures.some(isSearchUnsupportedError);
    const hasAnyTimeoutFailure = primaryFailures.some(isTimeoutError);
    let merged = primary.merged;
    const hadSuccessfulRelayResponse = primary.successCount > 0;
    const relayCount = relays.length;

    if (
      merged.size === 0 &&
      hasAnyTimeoutFailure &&
      !hasSearchUnsupportedFailure &&
      !hadSuccessfulRelayResponse
    ) {
      throw new Error('Notes search timed out. Retry to try again.');
    }

    if (merged.size === 0 && hasSearchUnsupportedFailure) {
      const fallback = await runQuery(false);
      const filtered = new Map<string, Event>();
      for (const [id, event] of fallback.merged) {
        if (!event?.content || !event.content.toLowerCase().includes(quoted)) continue;
        filtered.set(id, event);
      }
      merged = filtered;
    } else {
      // keep primary merge as-is
    }

    if (
      merged.size === 0 &&
      primaryFailures.length === relayCount &&
      !hasSearchUnsupportedFailure
    ) {
      const hasNetworkError = primaryFailures.some(isNetworkError);
      if (hasNetworkError) {
        const networkError = new Error(
          'Unable to connect to relays. Check your internet connection and try again.'
        );
        (networkError as { code?: string }).code = 'relay_network_error';
        throw networkError;
      }
      throw primaryFailures[0];
    }
    return [...merged.values()].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
  } catch (err) {
    const message = getErrorMessage(err);
    const lower = message.toLowerCase();
    const isNetworkOrUnsupported =
      lower.includes('failed to fetch') ||
      lower.includes('network error') ||
      lower.includes('dns') ||
      lower.includes('econnrefused') ||
      lower.includes('connection refused') ||
      lower.includes('connection failed') ||
      lower.includes('socket') ||
      lower.includes('enotfound') ||
      lower.includes('etimedout') ||
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('unrecognized filter') ||
      lower.includes('unrecognised filter');

    if (!isNetworkOrUnsupported) {
      console.warn('[nostr] search failed', err);
    }
    throw err;
  }
}
