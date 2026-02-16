import {
  Alphabet,
  Coordinate,
  Event as RustEvent,
  EventBuilder,
  EventId,
  Filter as RustFilter,
  Kind,
  loadWasmSync,
  Nip19Coordinate,
  Nip19Event,
  Nip19Profile,
  PublicKey,
  SecretKey,
  SingleLetterTag,
  start,
  Tag,
  Timestamp
} from '@rust-nostr/nostr-sdk';

import type { Event, EventTemplate, Filter } from './types.js';

let sdkStarted = false;

export function ensureSdk() {
  if (sdkStarted) return;
  sdkStarted = true;
  try {
    loadWasmSync();
  } catch {
    // Ignore if wasm is already initialized or if the environment forbids sync init.
  }
  try {
    start();
  } catch {
    // start() can throw if called multiple times in some environments.
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '').toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function toRustPublicKey(pubkey: string): PublicKey {
  return PublicKey.parse(pubkey);
}

export function toRustSecretKey(secret: Uint8Array): SecretKey {
  return SecretKey.parse(bytesToHex(secret));
}

export function toRustEvent(event: Event): RustEvent {
  return RustEvent.fromJson(JSON.stringify(event));
}

export function toRustEventBuilder(template: EventTemplate, pubkeyHex: string): EventBuilder {
  const builder = new EventBuilder(new Kind(template.kind), template.content ?? '');

  if (template.tags && template.tags.length > 0) {
    const tags = template.tags
      .filter((tag) => Array.isArray(tag) && tag.length > 0)
      .map((tag) => Tag.parse(tag));
    builder.tags(tags);
  }

  if (typeof template.created_at === 'number') {
    builder.customCreatedAt(Timestamp.fromSecs(template.created_at));
  }

  // Ensure pubkey is valid to prevent runtime errors when signing.
  toRustPublicKey(pubkeyHex);

  return builder;
}

export function eventToPlain(event: RustEvent): Event {
  const parsed = JSON.parse(event.asJson()) as Event;
  return parsed;
}

export function toRustFilter(filter: Filter): RustFilter {
  const rust = new RustFilter();

  if (Array.isArray(filter.ids) && filter.ids.length) {
    const ids = filter.ids
      .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
      .filter((id): id is string => /^[0-9a-f]{64}$/.test(id));
    if (ids.length) {
      rust.ids(ids.map((id) => EventId.parse(id)));
    }
  }

  if (Array.isArray(filter.authors) && filter.authors.length) {
    const authors = filter.authors
      .map((author) => (typeof author === 'string' ? author.trim().toLowerCase() : ''))
      .filter((author): author is string => /^[0-9a-f]{64}$/.test(author));
    if (authors.length) {
      rust.authors(authors.map((author) => PublicKey.parse(author)));
    }
  }

  if (Array.isArray(filter.kinds) && filter.kinds.length) {
    const kinds = filter.kinds
      .map((kind) => Number(kind))
      .filter((kind) => Number.isInteger(kind) && kind >= 0 && kind <= 0x7fffffff);
    if (kinds.length) {
      rust.kinds(kinds.map((kind) => new Kind(kind)));
    }
  }

  if (typeof filter.search === 'string' && filter.search.trim()) {
    rust.search(filter.search);
  }

  if (typeof filter.since === 'number' && Number.isInteger(filter.since) && filter.since > 0) {
    rust.since(Timestamp.fromSecs(filter.since));
  }

  if (typeof filter.until === 'number' && Number.isInteger(filter.until) && filter.until > 0) {
    rust.until(Timestamp.fromSecs(filter.until));
  }

  if (typeof filter.limit === 'number' && Number.isInteger(filter.limit) && filter.limit > 0) {
    rust.limit(filter.limit);
  }

  for (const [key, value] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(value) || value.length === 0) continue;
    const letters = key.slice(1);
    if (letters.length !== 1) continue;
    const letter = letters.toLowerCase();
    if (!letter) continue;
    const alphabet = alphabetForLetter(letter);
    if (!alphabet) continue;
    const tagValues = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry): entry is string => entry.length > 0);
    if (!tagValues.length) continue;
    const tag = SingleLetterTag.lowercase(alphabet);
    rust.customTags(tag, tagValues);
  }

  return rust;
}

function alphabetForLetter(letter: string): Alphabet | null {
  const upper = letter.toUpperCase();
  const alphabet = (Alphabet as unknown as Record<string, Alphabet>)[upper];
  return typeof alphabet === 'number' ? alphabet : null;
}

export function decodeNip19(value: string) {
  const cleaned = value.trim().replace(/^nostr:/i, '');
  const lower = cleaned.toLowerCase();

  if (lower.startsWith('npub')) {
    const pubkey = PublicKey.parse(cleaned).toHex();
    return { type: 'npub', data: pubkey } as const;
  }

  if (lower.startsWith('note')) {
    const id = EventId.parse(cleaned).toHex();
    return { type: 'note', data: id } as const;
  }

  if (lower.startsWith('nprofile')) {
    const profile = Nip19Profile.fromBech32(cleaned);
    return {
      type: 'nprofile',
      data: {
        pubkey: profile.publicKey().toHex(),
        relays: profile.relays()
      }
    } as const;
  }

  if (lower.startsWith('nevent')) {
    const ev = Nip19Event.fromBech32(cleaned);
    const author = ev.author();
    const kind = ev.kind();
    return {
      type: 'nevent',
      data: {
        id: ev.eventId().toHex(),
        relays: ev.relays(),
        ...(author ? { author: author.toHex() } : {}),
        ...(kind ? { kind: kind.asU16() } : {})
      }
    } as const;
  }

  if (lower.startsWith('naddr')) {
    const addr = Nip19Coordinate.fromBech32(cleaned);
    const coordinate = addr.coordinate();
    return {
      type: 'naddr',
      data: {
        kind: coordinate.kind.asU16(),
        pubkey: coordinate.publicKey.toHex(),
        identifier: coordinate.identifier,
        relays: addr.relays()
      }
    } as const;
  }

  if (lower.startsWith('nsec')) {
    const secret = SecretKey.parse(cleaned).toHex();
    return { type: 'nsec', data: hexToBytes(secret) } as const;
  }

  throw new Error('Wrong string length');
}

export function encodeNprofile(pubkey: string, relays: string[] = []): string {
  const profile = new Nip19Profile(PublicKey.parse(pubkey), relays);
  return profile.toBech32();
}

export function encodeNevent(id: string, relays: string[] = [], author?: string): string {
  const eventId = EventId.parse(id);
  const authorKey = author ? PublicKey.parse(author) : undefined;
  const event = new Nip19Event(eventId, authorKey ?? null, null, relays);
  return event.toBech32();
}

export function encodeNaddr(
  kind: number,
  pubkey: string,
  identifier: string,
  relays: string[] = []
): string {
  const coordinate = new Coordinate(new Kind(kind), PublicKey.parse(pubkey), identifier);
  const addr = new Nip19Coordinate(coordinate, relays);
  return addr.toBech32();
}
