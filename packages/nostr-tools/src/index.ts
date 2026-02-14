export { nip04, nip44 } from './nip04.js';
export { SimplePool } from './pool.js';
export {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  validateEvent,
  verifyEvent
} from './pure.js';
export { Relay, relayInit } from './relay.js';
export type { Event, EventTemplate, Filter, Subscription } from './types.js';
export { bytesToHex, hexToBytes, normalizeURL } from './utils.js';

import { EventId, PublicKey, SecretKey } from '@rust-nostr/nostr-sdk';

import {
  bytesToHex,
  decodeNip19,
  encodeNaddr,
  encodeNevent,
  encodeNprofile,
  ensureSdk
} from './internal.js';

export const nip19 = {
  decode(value: string) {
    ensureSdk();
    return decodeNip19(value);
  },
  npubEncode(pubkey: string): string {
    ensureSdk();
    return PublicKey.parse(pubkey).toBech32();
  },
  noteEncode(id: string): string {
    ensureSdk();
    return EventId.parse(id).toBech32();
  },
  nprofileEncode({ pubkey, relays = [] }: { pubkey: string; relays?: string[] }): string {
    ensureSdk();
    return encodeNprofile(pubkey, relays);
  },
  neventEncode({
    id,
    relays = [],
    author
  }: {
    id: string;
    relays?: string[];
    author?: string;
  }): string {
    ensureSdk();
    return encodeNevent(id, relays, author);
  },
  naddrEncode({
    kind,
    pubkey,
    identifier,
    relays = []
  }: {
    kind: number;
    pubkey: string;
    identifier: string;
    relays?: string[];
  }): string {
    ensureSdk();
    return encodeNaddr(kind, pubkey, identifier, relays);
  },
  nsecEncode(secret: string | Uint8Array): string {
    ensureSdk();
    if (secret instanceof Uint8Array) {
      return SecretKey.parse(bytesToHex(secret)).toBech32();
    }
    return SecretKey.parse(secret).toBech32();
  }
};
