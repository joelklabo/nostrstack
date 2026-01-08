/** Target reference decoded from a Nostr identifier (note, nevent, npub, nprofile, naddr) */
export type NostrTarget =
  | { type: 'event'; id: string; relays: string[] }
  | { type: 'profile'; pubkey: string; relays: string[] }
  | { type: 'address'; kind: number; pubkey: string; identifier: string; relays: string[] };

/** Profile metadata from kind:0 events (NIP-01) */
export type ProfileMeta = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
};

/** Threading references extracted from event tags (NIP-10) */
export type ThreadingReferences = {
  root: string[];
  reply: string[];
  mention: string[];
};

/** Inline mentions parsed from content */
export type InlineMentions = {
  events: string[];
  profiles: string[];
  addresses: string[];
};
