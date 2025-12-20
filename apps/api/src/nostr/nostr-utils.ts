import { type Event, nip19 } from 'nostr-tools';

type NostrRelaysHint = { relays?: string[] };

export type NostrTarget =
  | { type: 'event'; id: string; relays: string[] }
  | { type: 'profile'; pubkey: string; relays: string[] }
  | { type: 'address'; kind: number; pubkey: string; identifier: string; relays: string[] };

export type ProfileMeta = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
};

const NOSTR_URI_RE = /nostr:([0-9a-z]+)/gi;

export function normalizeNostrInput(raw: string) {
  return raw.trim().replace(/^nostr:/i, '');
}

export function isHex64(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

export function decodeNostrTarget(raw: string): NostrTarget | null {
  const cleaned = normalizeNostrInput(raw);

  if (isHex64(cleaned)) {
    return { type: 'event', id: cleaned.toLowerCase(), relays: [] };
  }

  try {
    const decoded = nip19.decode(cleaned.toLowerCase());
    if (decoded.type === 'note') {
      return { type: 'event', id: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nevent') {
      const data = decoded.data as { id: string } & NostrRelaysHint;
      return { type: 'event', id: data.id, relays: data.relays ?? [] };
    }
    if (decoded.type === 'npub') {
      return { type: 'profile', pubkey: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nprofile') {
      const data = decoded.data as { pubkey: string } & NostrRelaysHint;
      return { type: 'profile', pubkey: data.pubkey, relays: data.relays ?? [] };
    }
    if (decoded.type === 'naddr') {
      const data = decoded.data as { kind: number; pubkey: string; identifier: string } & NostrRelaysHint;
      return {
        type: 'address',
        kind: data.kind,
        pubkey: data.pubkey,
        identifier: data.identifier,
        relays: data.relays ?? []
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function parseProfileContent(content?: string): ProfileMeta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as ProfileMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function getTagValues(event: Event, tag: string) {
  return event.tags
    .filter((t) => t[0] === tag)
    .map((t) => t[1])
    .filter((value): value is string => Boolean(value));
}

export function parseInlineMentions(content?: string) {
  const events: string[] = [];
  const profiles: string[] = [];
  const addresses: string[] = [];
  if (!content) return { events, profiles, addresses };

  for (const match of content.matchAll(NOSTR_URI_RE)) {
    const token = match[1];
    if (!token) continue;
    try {
      const decoded = nip19.decode(token.toLowerCase());
      if (decoded.type === 'note') {
        events.push(decoded.data as string);
      } else if (decoded.type === 'nevent') {
        const data = decoded.data as { id: string };
        if (data?.id) events.push(data.id);
      } else if (decoded.type === 'npub') {
        profiles.push(decoded.data as string);
      } else if (decoded.type === 'nprofile') {
        const data = decoded.data as { pubkey: string };
        if (data?.pubkey) profiles.push(data.pubkey);
      } else if (decoded.type === 'naddr') {
        const data = decoded.data as { kind: number; pubkey: string; identifier: string };
        if (data?.pubkey && data?.identifier != null && data?.kind != null) {
          addresses.push(`${data.kind}:${data.pubkey}:${data.identifier}`);
        }
      }
    } catch {
      // ignore invalid mentions
    }
  }

  return {
    events: uniq(events),
    profiles: uniq(profiles),
    addresses: uniq(addresses)
  };
}
