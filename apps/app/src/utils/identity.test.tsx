import { act, renderHook } from '@testing-library/react';
import { getPublicKey, nip19 } from 'nostr-tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIdentityResolver } from '../hooks/useIdentityResolver';
import * as identityModule from './identity';
import { type IdentityResolution, resolveIdentity } from './identity';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resolveIdentity', () => {
  it('returns error for empty input', async () => {
    const result = await resolveIdentity('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('empty');
    }
  });

  it('parses hex pubkeys with whitespace and mixed case', async () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(3));
    const result = await resolveIdentity(`  ${pubkey.toUpperCase()}  `);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pubkey).toBe(pubkey.toLowerCase());
      expect(result.value.source).toBe('hex');
    }
  });

  it('parses npub identifiers', async () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(7));
    const npub = nip19.npubEncode(pubkey);
    const result = await resolveIdentity(npub);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pubkey).toBe(pubkey.toLowerCase());
      expect(result.value.source).toBe('npub');
    }
  });

  it('parses nprofile identifiers with relays', async () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(9));
    const nprofile = nip19.nprofileEncode({
      pubkey,
      relays: ['wss://relay.example', '  wss://relay2.example  ']
    });
    const result = await resolveIdentity(nprofile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pubkey).toBe(pubkey.toLowerCase());
      expect(result.value.source).toBe('nprofile');
      expect(result.value.relays).toEqual(['wss://relay.example', 'wss://relay2.example']);
    }
  });

  it('resolves nip05 via proxy', async () => {
    const pubkey = getPublicKey(new Uint8Array(32).fill(4));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ pubkey, relays: ['wss://relay.example'] })
    } as Response);

    const result = await resolveIdentity('Alice@LocalHost', { apiBase: 'https://api.example.com' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pubkey).toBe(pubkey.toLowerCase());
      expect(result.value.source).toBe('nip05');
      expect(result.value.nip05).toBe('alice@localhost');
      expect(result.value.relays).toEqual(['wss://relay.example']);
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/nostr/identity?nip05=alice%40localhost',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns lightning_only when nip05 is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    } as Response);

    const result = await resolveIdentity('alice@localhost', { apiBase: 'https://api.example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lightning_only');
      expect(result.error.lightning).toBe('alice@localhost');
    }
  });

  it('returns nip05_timeout on abort errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('abort'), { name: 'AbortError' })
    );

    const result = await resolveIdentity('alice@localhost', { apiBase: 'https://api.example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('nip05_timeout');
    }
  });

  it('returns invalid_format for unsupported inputs', async () => {
    const result = await resolveIdentity('not-a-nostr-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_format');
    }
  });
});

describe('useIdentityResolver', () => {
  it('debounces resolution and trims input', async () => {
    vi.useFakeTimers();
    const resolution: IdentityResolution = {
      ok: true,
      value: {
        pubkey: 'a'.repeat(64),
        source: 'hex'
      }
    };
    const resolveSpy = vi.spyOn(identityModule, 'resolveIdentity').mockResolvedValue(resolution);

    const { result, rerender } = renderHook(
      ({ value }) => useIdentityResolver(value, { debounceMs: 200 }),
      { initialProps: { value: '' } }
    );

    act(() => rerender({ value: '  npub1abc  ' }));
    expect(result.current.status).toBe('validating');
    expect(resolveSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(resolveSpy).toHaveBeenCalledWith(
      'npub1abc',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.status).toBe('resolved');
    expect(result.current.result?.pubkey).toBe('a'.repeat(64));
  });

  it('sets error state from resolveNow failures', async () => {
    const resolution: IdentityResolution = {
      ok: false,
      error: {
        code: 'invalid_format',
        message: 'invalid'
      }
    };
    const resolveSpy = vi.spyOn(identityModule, 'resolveIdentity').mockResolvedValue(resolution);
    const { result } = renderHook(() => useIdentityResolver('', { debounceMs: 0 }));

    await act(async () => {
      await result.current.resolveNow('not-a-key');
    });

    expect(resolveSpy).toHaveBeenCalledWith(
      'not-a-key',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('invalid_format');
  });
});
