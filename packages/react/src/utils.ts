import { nip19 } from 'nostr-tools';
import { bytesToHex, hexToBytes, normalizeURL } from 'nostr-tools/utils';

export function parseLnAddress(
  value?: string | null
): { username: string; domain?: string } | null {
  if (!value) return null;
  const parts = value.split('@');
  if (parts.length === 1) {
    return { username: parts[0] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { username: parts[0], domain: parts[1] };
  }
  return null;
}

export function parseRelays(raw?: string | null): string[] {
  if (!raw) return [];
  const relays = raw
    .split(/[,\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (relays.length === 1 && relays[0].toLowerCase() === 'mock') {
    return [];
  }
  return relays;
}

export type ParsedNwcUri = {
  walletPubkey: string;
  secret: Uint8Array;
  secretHex: string;
  relays: string[];
  lud16?: string;
};

function normalizeNostrPubkey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Missing NWC wallet pubkey');
  if (trimmed.startsWith('npub')) {
    const decoded = nip19.decode(trimmed.toLowerCase());
    const data = decoded.data as unknown;
    if (decoded.type !== 'npub' || !(data instanceof Uint8Array)) {
      throw new Error('Invalid NWC wallet pubkey');
    }
    return bytesToHex(data);
  }
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  throw new Error('Invalid NWC wallet pubkey');
}

function normalizeNostrSecret(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Missing NWC secret');
  if (trimmed.startsWith('nsec')) {
    const decoded = nip19.decode(trimmed.toLowerCase());
    const data = decoded.data as unknown;
    if (decoded.type !== 'nsec' || !(data instanceof Uint8Array)) {
      throw new Error('Invalid NWC secret');
    }
    return data as Uint8Array;
  }
  if (!/^[0-9a-f]{64}$/i.test(trimmed)) {
    throw new Error('Invalid NWC secret');
  }
  return hexToBytes(trimmed);
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
  return [...new Set(cleaned)];
}

export function parseNwcUri(raw: string): ParsedNwcUri {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Missing NWC URI');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Invalid NWC URI');
  }
  if (url.protocol !== 'nostr+walletconnect:') {
    throw new Error('Invalid NWC URI protocol');
  }
  const rawPubkey = url.hostname || url.pathname.replace(/^\/+/, '');
  const walletPubkey = normalizeNostrPubkey(rawPubkey);
  const secret = normalizeNostrSecret(url.searchParams.get('secret') ?? '');
  const relayParams = url.searchParams.getAll('relay');
  const relaysParam = url.searchParams.get('relays');
  const relays = normalizeRelayList([...relayParams, ...parseRelays(relaysParam)]);
  if (!relays.length) throw new Error('NWC URI missing relay');
  const lud16 = url.searchParams.get('lud16') ?? undefined;
  return {
    walletPubkey,
    secret,
    secretHex: bytesToHex(secret),
    relays,
    lud16
  };
}
