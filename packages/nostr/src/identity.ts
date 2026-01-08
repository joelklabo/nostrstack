import { nip19 } from 'nostr-tools';

import { type NostrTarget } from './types.js';
import { isHex64, normalizeNostrInput } from './utils.js';

type NostrRelaysHint = { relays?: string[] };

/**
 * Decode a Nostr identifier (hex, note, nevent, npub, nprofile, naddr) into a structured target.
 * Supports optional `nostr:` prefix.
 */
export function decodeNostrTarget(raw: string): NostrTarget | null {
  const cleaned = normalizeNostrInput(raw);

  // Plain hex ID - assume it's an event
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
      const data = decoded.data as {
        kind: number;
        pubkey: string;
        identifier: string;
      } & NostrRelaysHint;
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

/**
 * Encode a hex pubkey to npub format
 */
export function encodeNpub(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

/**
 * Encode an event ID to note format
 */
export function encodeNote(eventId: string): string {
  return nip19.noteEncode(eventId);
}

/**
 * Encode a profile with optional relay hints to nprofile format
 */
export function encodeNprofile(pubkey: string, relays?: string[]): string {
  return nip19.nprofileEncode({ pubkey, relays });
}

/**
 * Encode an event with optional relay hints to nevent format
 */
export function encodeNevent(id: string, relays?: string[], author?: string): string {
  return nip19.neventEncode({ id, relays, author });
}
