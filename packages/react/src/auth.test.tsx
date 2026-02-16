import { act, renderHook } from '@testing-library/react';
import { type Event, type EventTemplate, finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth';

vi.mock('nostr-tools', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vi.importOriginal requires inline import() syntax
  const mod = await importOriginal<typeof import('nostr-tools')>();
  return {
    ...mod,
    getPublicKey: vi.fn(),
    finalizeEvent: vi.fn()
  };
});

vi.mock('nostr-tools/utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vi.importOriginal requires inline import() syntax
  const mod = await importOriginal<typeof import('nostr-tools/utils')>();
  return {
    ...mod
  };
});

const mockNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'; // Valid NSEC
const mockPubkey = getPublicKey(nip19.decode(mockNsec).data as Uint8Array);

// Mock window.nostr for NIP-07 tests
const mockWindowNostr = {
  getPublicKey: vi.fn(() => Promise.resolve(mockPubkey)),
  signEvent: vi.fn((event) => Promise.resolve({ ...event, id: 'mockedId', sig: 'mockedSig' }))
};
Object.defineProperty(window, 'nostr', {
  writable: true,
  value: mockWindowNostr
});

describe('AuthProvider and useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    // Reset window.nostr to the mocked version for each test
    Object.defineProperty(window, 'nostr', {
      writable: true,
      value: mockWindowNostr
    });
    // Mock nostr-tools functions
    (getPublicKey as Mock).mockReturnValue(mockPubkey);
    (finalizeEvent as Mock).mockImplementation((template: EventTemplate) => ({
      ...template,
      id: 'mockedId',
      sig: 'mockedSig'
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial state is guest and loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(100); // Advance timer for the setTimeout in useEffect
      await Promise.resolve(); // Flush microtasks
    });
    if (result.current) {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.mode).toBe('guest');
      expect(result.current.pubkey).toBe(null);
    } else {
      throw new Error('result.current is null');
    }
  });

  it('logs in with NIP-07 successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await result.current.loginWithNip07();
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });

    if (result.current) {
      expect(result.current.mode).toBe('nip07');
      expect(result.current.pubkey).toBe(mockPubkey);
      expect(result.current.isLoading).toBe(false);
    }
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe('nip07');
    expect(window.nostr?.getPublicKey).toHaveBeenCalled();
  });

  it('NIP-07 login fails if extension not found', async () => {
    Object.defineProperty(window, 'nostr', { writable: true, value: undefined });
    localStorage.setItem('nostrstack.auth.mode', 'nip07'); // Trigger polling
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    }); // Ensure initial useEffect has run

    await act(async () => {
      vi.advanceTimersByTime(2000); // Give enough time for NIP-07 check timeout (100ms * 10+ attempts)
      await Promise.resolve(); // Wait for promise microtasks
    });
    // Need to await act for the state update to propagate
    await act(async () => {});
    expect(result.current.error).toBe('NIP-07 extension not found');
    expect(result.current.mode).toBe('guest');
  });

  it('NIP-07 login fails gracefully if getPublicKey throws', async () => {
    (window.nostr!.getPublicKey as Mock).mockRejectedValueOnce(new Error('User denied'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await expect(result.current.loginWithNip07()).rejects.toThrow('User denied');
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });

    if (result.current) {
      expect(result.current.mode).toBe('guest');
      expect(result.current.pubkey).toBe(null);
      expect(result.current.error).toBe('User denied');
    }
  });

  it('NIP-07 login handles missing extension without throwing', async () => {
    Object.defineProperty(window, 'nostr', { writable: true, value: undefined });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await expect(result.current.loginWithNip07()).resolves.toBeUndefined();
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });

    if (result.current) {
      expect(result.current.mode).toBe('guest');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('NIP-07 extension not found');
    }
  });

  it('logs in with NSEC successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await result.current.loginWithNsec(mockNsec);
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });
    if (result.current) {
      expect(result.current.pubkey).toBe(mockPubkey);
      expect(result.current.isLoading).toBe(false);
    }
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe('nsec');
    expect(localStorage.getItem('nostrstack.auth.nsec')).toBe(mockNsec);
    expect(getPublicKey).toHaveBeenCalled();
  });

  it('NSEC login fails with invalid nsec', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await expect(result.current.loginWithNsec('invalid')).rejects.toThrow(
          /Wrong string length/
        );
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });
    if (result.current) {
      expect(result.current.mode).toBe('guest');
      expect(result.current.pubkey).toBe(null);
      expect(result.current.error).toMatch(/Wrong string length/);
    }
  });

  it('logs out successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      if (result.current) {
        await result.current.loginWithNip07();
        vi.advanceTimersByTime(1);
      }
    });
    if (result.current) expect(result.current.pubkey).toBe(mockPubkey);

    await act(async () => {
      if (result.current) {
        result.current.logout();
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });

    if (result.current) {
      expect(result.current.mode).toBe('guest');
      expect(result.current.pubkey).toBe(null);
    }
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe(null);
    expect(localStorage.getItem('nostrstack.auth.nsec')).toBe(null);
  });

  it('signs event with NIP-07', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    await act(async () => {
      if (result.current) {
        await result.current.loginWithNip07();
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });

    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    let signedEvent: Event | undefined;
    await act(async () => {
      if (result.current) {
        signedEvent = await result.current.signEvent(mockEventTemplate);
      }
    });

    expect(window.nostr?.signEvent).toHaveBeenCalledWith(mockEventTemplate);
    if (signedEvent) expect(signedEvent.id).toBe('mockedId');
  });

  it('signs event with NSEC', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    await act(async () => {
      if (result.current) {
        await result.current.loginWithNsec(mockNsec);
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });
    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    let signedEvent: Event | undefined;
    await act(async () => {
      if (result.current) {
        signedEvent = await result.current.signEvent(mockEventTemplate);
      }
    });

    expect(finalizeEvent).toHaveBeenCalledWith(mockEventTemplate, expect.any(Uint8Array));
    if (signedEvent) expect(signedEvent.id).toBe('mockedId');
  });

  it('signEvent throws if not authenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider }); // starts as guest
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    await act(async () => {
      if (result.current) {
        await expect(result.current.signEvent(mockEventTemplate)).rejects.toThrow(
          'No signer available'
        );
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      }
    });
  });
});
