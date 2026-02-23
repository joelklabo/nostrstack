import { getPublicKey, nip19 } from 'nostr-tools';
import { describe, expect, it } from 'vitest';

import { parseAppRoute, resolveProfileRoute } from './navigation';

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

  it('accepts hex pubkeys with query string', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(1));
    const result = resolveProfileRoute(`/p/${pubkey}?tab=about`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('accepts npub with query string', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(2));
    const npub = nip19.npubEncode(pubkey);
    const result = resolveProfileRoute(`/p/${npub}?tab=relays`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('handles encoded npub in path', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(3));
    const npub = nip19.npubEncode(pubkey);
    const encodedNpub = encodeURIComponent(npub);
    const result = resolveProfileRoute(`/p/${encodedNpub}`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('handles nostr: prefix', () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(5));
    const npub = nip19.npubEncode(pubkey);
    const result = resolveProfileRoute(`/p/nostr:${npub}`);
    expect(result.pubkey).toBe(pubkey.toLowerCase());
    expect(result.error).toBeUndefined();
  });

  it('returns null for /profile route without pubkey', () => {
    const result = resolveProfileRoute('/profile');
    expect(result.pubkey).toBeNull();
  });
});

describe('parseAppRoute', () => {
  it('normalizes trailing slashes and query strings for known routes', () => {
    const route = parseAppRoute('/search/?tab=people');
    expect(route.kind).toBe('search');
  });

  it('parses event routes and marks them as event kind', () => {
    const route = parseAppRoute('/nostr/abc123');
    expect(route.kind).toBe('event');
    expect(route.eventId).toBe('abc123');
  });

  it('keeps invalid profile paths in the profile route kind', () => {
    const route = parseAppRoute('/p/not-a-key');
    expect(route.kind).toBe('profile');
    expect(route.profile).toBeDefined();
    expect(route.profile?.error).toBe('Invalid profile id.');
  });
});
