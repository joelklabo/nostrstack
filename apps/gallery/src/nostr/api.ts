import type { Event } from 'nostr-tools';

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
