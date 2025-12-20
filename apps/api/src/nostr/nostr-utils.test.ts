import { nip19 } from 'nostr-tools';
import { describe, expect, it } from 'vitest';

import { decodeNostrTarget, parseProfileContent } from './nostr-utils.js';

describe('decodeNostrTarget', () => {
  it('decodes hex and note identifiers', () => {
    const hex = 'a'.repeat(64);
    const note = nip19.noteEncode(hex);

    expect(decodeNostrTarget(hex)).toEqual({ type: 'event', id: hex, relays: [] });
    expect(decodeNostrTarget(`nostr:${note}`)).toEqual({ type: 'event', id: hex, relays: [] });
  });

  it('decodes nevent relay hints', () => {
    const id = 'b'.repeat(64);
    const relays = ['wss://relay.example'];
    const nevent = nip19.neventEncode({ id, relays });

    expect(decodeNostrTarget(nevent)).toEqual({ type: 'event', id, relays });
  });

  it('decodes npub and nprofile identifiers', () => {
    const pubkey = 'c'.repeat(64);
    const npub = nip19.npubEncode(pubkey);
    const relays = ['wss://relay.profile'];
    const nprofile = nip19.nprofileEncode({ pubkey, relays });

    expect(decodeNostrTarget(npub)).toEqual({ type: 'profile', pubkey, relays: [] });
    expect(decodeNostrTarget(nprofile)).toEqual({ type: 'profile', pubkey, relays });
  });

  it('decodes naddr identifiers', () => {
    const pubkey = 'd'.repeat(64);
    const relays = ['wss://relay.addr'];
    const naddr = nip19.naddrEncode({ pubkey, kind: 30023, identifier: 'slug', relays });

    expect(decodeNostrTarget(naddr)).toEqual({
      type: 'address',
      kind: 30023,
      pubkey,
      identifier: 'slug',
      relays
    });
  });

  it('returns null for invalid identifiers', () => {
    expect(decodeNostrTarget('not-a-nostr-id')).toBeNull();
  });
});

describe('parseProfileContent', () => {
  it('parses valid profile JSON', () => {
    const profile = parseProfileContent('{"name":"alice","about":"hello"}');
    expect(profile).toEqual({ name: 'alice', about: 'hello' });
  });

  it('returns null for missing or invalid JSON', () => {
    expect(parseProfileContent()).toBeNull();
    expect(parseProfileContent('{oops')).toBeNull();
  });
});
