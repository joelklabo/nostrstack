import { parseRelays } from '@nostrstack/blog-kit';
import type { Event, SimplePool } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';

import type { ProfileMeta } from './eventRenderers';

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

export type ApiNostrEventResponse = {
  target: ApiNostrTarget;
  event: Event;
  author: {
    pubkey: string;
    profile: ProfileMeta | null;
  };
  references: ApiNostrReferences;
};

export const SEARCH_RELAYS = ['wss://relay.nostr.band', 'wss://search.nos.lol'];
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const RELAY_FAILURE_KEY = 'nostrstack.relayFailures.v1';
const RELAY_FAILURE_TTL_MS = 10 * 60 * 1000;

type RelayFailureState = Record<string, number>;

function relayStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readRelayFailures(storage: Storage | null): RelayFailureState {
  if (!storage) return {};
  try {
    const raw = storage.getItem(RELAY_FAILURE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RelayFailureState;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeRelayFailures(storage: Storage | null, state: RelayFailureState) {
  if (!storage) return;
  try {
    storage.setItem(RELAY_FAILURE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
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
  const storage = relayStorage();
  if (!storage) return normalized;
  const failures = readRelayFailures(storage);
  const now = Date.now();
  let mutated = false;
  const filtered = normalized.filter((relay) => {
    const failedAt = failures[relay];
    if (!failedAt) return true;
    if (now - failedAt > RELAY_FAILURE_TTL_MS) {
      delete failures[relay];
      mutated = true;
      return true;
    }
    return false;
  });
  if (mutated) writeRelayFailures(storage, failures);
  return filtered.length ? filtered : normalized;
}

export function markRelayFailure(relay: string) {
  const storage = relayStorage();
  if (!storage) return;
  let normalized: string;
  try {
    normalized = normalizeURL(relay);
  } catch {
    return;
  }
  const failures = readRelayFailures(storage);
  failures[normalized] = Date.now();
  writeRelayFailures(storage, failures);
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
  signal?: AbortSignal;
};

function buildNostrEventUrl(
  baseUrl: string,
  id: string,
  params: { relays?: string[]; limitRefs?: number; timeoutMs?: number } = {}
) {
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const query = new URLSearchParams();
  if (params.relays?.length) query.set('relays', params.relays.join(','));
  if (params.limitRefs != null) query.set('limitRefs', String(params.limitRefs));
  if (params.timeoutMs != null) query.set('timeoutMs', String(params.timeoutMs));
  const suffix = query.toString();
  return `${base}/api/nostr/event/${encodeURIComponent(id)}${suffix ? `?${suffix}` : ''}`;
}

function parseApiError(bodyText: string, status: number) {
  let message = bodyText || `HTTP ${status}`;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as ApiErrorResponse;
      message = parsed.message || parsed.error || message;
    } catch {
      // ignore parse failures
    }
  }
  return message;
}

export async function fetchNostrEventFromApi(options: FetchOptions): Promise<ApiNostrEventResponse> {
  const url = buildNostrEventUrl(options.baseUrl, options.id, {
    relays: options.relays,
    limitRefs: options.limitRefs,
    timeoutMs: options.timeoutMs
  });
  const res = await fetch(url, {
    signal: options.signal,
    headers: { Accept: 'application/json' }
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(bodyText, res.status));
  }
  if (!bodyText) {
    throw new Error('Empty API response.');
  }
  const data = JSON.parse(bodyText) as ApiNostrEventResponse;
  if (!data?.event || !data?.target) {
    throw new Error('Invalid API response.');
  }
  return data;
}

export async function searchNotes(pool: SimplePool, relays: string[], query: string, limit = 20): Promise<Event[]> {
  try {
    return await pool.querySync(relays, { kinds: [1], search: query, limit });
  } catch (err) {
    console.error('[nostr] search failed', err);
    return [];
  }
}

