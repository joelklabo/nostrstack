/**
 * Nostr relay connection utilities
 */

import { DEFAULT_RELAYS, LOCAL_RELAY_HOSTS } from './config.js';
import type { NostrEvent } from './types.js';

export interface RelayConnection {
  url?: string;
  connect: () => Promise<void>;
  close: () => void;
  sub: (filters: unknown) => {
    on: (type: string, cb: (ev: NostrEvent) => void) => void;
    un: () => void;
  };
  publish: (ev: NostrEvent) => Promise<unknown>;
}

/**
 * Check if a relay URL is allowed (wss:// or ws:// for localhost)
 */
export function isAllowedRelayUrl(url: string): boolean {
  if (/^wss:\/\//i.test(url)) return true;
  if (!/^ws:\/\//i.test(url)) return false;
  const host = url.replace(/^ws:\/\//i, '').split(/[/?#]/)[0] ?? '';
  return LOCAL_RELAY_HOSTS.has(host);
}

/**
 * Normalize and validate relay URLs
 */
export function normalizeRelayUrls(relays?: string[]): { valid: string[]; invalid: string[] } {
  const raw = relays ?? DEFAULT_RELAYS;
  const cleaned = raw.map((r) => r.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  cleaned.forEach((url) => {
    if (isAllowedRelayUrl(url)) valid.push(url);
    else invalid.push(url);
  });
  return { valid, invalid };
}

/**
 * Get NostrTools relay init function from window
 */
export function getRelayInit(): ((url: string) => RelayConnection) | undefined {
  return (window as unknown as { NostrTools?: { relayInit?: (url: string) => RelayConnection } })
    .NostrTools?.relayInit;
}

/**
 * Connect to multiple relays, filtering out failed connections
 */
export async function connectRelays(urls: string[]): Promise<RelayConnection[]> {
  const relayInit = getRelayInit();
  if (!relayInit) return [];
  const relays = await Promise.all(
    urls.map(async (url) => {
      const relay = relayInit(url);
      relay.url = relay.url ?? url;
      try {
        await relay.connect();
        return relay;
      } catch (e) {
        console.warn('relay connect failed', url, e);
        return null;
      }
    })
  );
  return relays.filter((r): r is RelayConnection => Boolean(r));
}
