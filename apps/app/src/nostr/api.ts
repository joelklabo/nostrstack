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

export const SEARCH_RELAYS = ['wss://relay.nostr.band', 'wss://search.nos.lol'];
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

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

  // Filter out unhealthy relays
  const filtered = normalized.filter((url) => relayMonitor.isHealthy(url));

  return filtered.length ? filtered : normalized;
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

export async function searchNotes(
  pool: SimplePool,
  relays: string[],
  query: string,
  limit = 20,
  until?: number
): Promise<Event[]> {
  try {
    const filter: { kinds: number[]; search: string; limit: number; until?: number } = {
      kinds: [1],
      search: query,
      limit
    };
    if (until) {
      filter.until = until;
    }
    return await pool.querySync(relays, filter);
  } catch (err) {
    console.error('[nostr] search failed', err);
    return [];
  }
}
