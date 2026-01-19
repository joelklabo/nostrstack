import { getPublicKey, nip19 } from 'nostr-tools';
import { describe, expect, it } from 'vitest';

import { resolveProfileRoute } from './navigation';

describe('resolveProfileRoute', () => {
  it('accepts hex pubkeys', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(4));
    const result = resolveProfileRoute(`/p/${pubkey}`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('accepts npub identifiers', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(7));
    const npub = nip19.npubEncode(pubkey);
    const result = resolveProfileRoute(`/p/${npub}`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('returns error for invalid ids', () => {
    const result = resolveProfileRoute('/p/not-a-key');
    expect(result.pubkey).toBeNull();
    expect(result.error).toBe('Invalid profile id.');
  });
});
