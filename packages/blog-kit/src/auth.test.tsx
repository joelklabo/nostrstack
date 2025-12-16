import { renderHook, act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';

import { AuthProvider, useAuth } from './auth';

vi.mock('nostr-tools', async (importOriginal) => {
  const mod = await importOriginal<typeof import('nostr-tools')>();
  return {
    ...mod,
    getPublicKey: vi.fn(),
    finalizeEvent: vi.fn(),
  };
});

const mockNsec = 'nsec1qtm34w05q829p3p5g4v0y88s8s0s5c3m0x9f5f0s5c3m0s0w0e0g5v5h4s5j8h7j3h5g8h4v2c4s5j2d7h2'; // Generated valid nsec
const mockPubkey = getPublicKey(nip19.decode(mockNsec).data as Uint8Array);

// Mock window.nostr for NIP-07 tests
const mockWindowNostr = {
  getPublicKey: vi.fn(() => Promise.resolve(mockPubkey)),
  signEvent: vi.fn((event) => Promise.resolve({ ...event, id: 'mockedId', sig: 'mockedSig' })),
};
Object.defineProperty(window, 'nostr', {
  writable: true,
  value: mockWindowNostr,
});

describe('AuthProvider and useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset window.nostr to the mocked version for each test
    Object.defineProperty(window, 'nostr', {
      writable: true,
      value: mockWindowNostr,
    });
    // Mock nostr-tools functions
    (getPublicKey as vi.Mock).mockReturnValue(mockPubkey);
    (finalizeEvent as vi.Mock).mockImplementation((template) => ({ ...template, id: 'mockedId', sig: 'mockedSig' }));
  });

  it('initial state is guest and loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    // isLoading becomes false after initial useEffect runs
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0)); // Await for useEffect to run
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mode).toBe('guest');
    expect(result.current.pubkey).toBe(null);
  });

  it('logs in with NIP-07 successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.loginWithNip07();
    });

    expect(result.current.mode).toBe('nip07');
    expect(result.current.pubkey).toBe(mockPubkey);
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe('nip07');
    expect(window.nostr?.getPublicKey).toHaveBeenCalled();
  });

  it('NIP-07 login fails if extension not found', async () => {
    Object.defineProperty(window, 'nostr', { writable: true, value: undefined });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200)); // Give enough time for NIP-07 check timeout
    });
    expect(result.current.error).toBe('NIP-07 extension not found');
    expect(result.current.mode).toBe('guest');
  });

  it('NIP-07 login fails gracefully if getPublicKey throws', async () => {
    (window.nostr!.getPublicKey as vi.Mock).mockRejectedValueOnce(new Error('User denied'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(result.current.loginWithNip07()).rejects.toThrow('User denied');
    });

    expect(result.current.mode).toBe('guest');
    expect(result.current.pubkey).toBe(null);
    expect(result.current.error).toBe('User denied');
  });

  it('logs in with NSEC successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.loginWithNsec(mockNsec);
    });

    expect(result.current.mode).toBe('nsec');
    expect(result.current.pubkey).toBe(mockPubkey);
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe('nsec');
    expect(localStorage.getItem('nostrstack.auth.nsec')).toBe(mockNsec);
    expect(getPublicKey).toHaveBeenCalled();
  });

  it('NSEC login fails with invalid nsec', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(result.current.loginWithNsec('invalid')).rejects.toThrow('Invalid nsec');
    });
    expect(result.current.mode).toBe('guest');
    expect(result.current.pubkey).toBe(null);
    expect(result.current.error).toBe('Invalid nsec');
  });

  it('logs out successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.loginWithNip07();
    });
    expect(result.current.pubkey).toBe(mockPubkey);

    await act(async () => {
      result.current.logout();
    });

    expect(result.current.mode).toBe('guest');
    expect(result.current.pubkey).toBe(null);
    expect(localStorage.getItem('nostrstack.auth.mode')).toBe(null);
    expect(localStorage.getItem('nostrstack.auth.nsec')).toBe(null);
  });

  it('signs event with NIP-07', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.loginWithNip07();
    });

    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    const signedEvent = await act(() => result.current.signEvent(mockEventTemplate));

    expect(window.nostr?.signEvent).toHaveBeenCalledWith(mockEventTemplate);
    expect(signedEvent.id).toBe('mockedId');
  });

  it('signs event with NSEC', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.loginWithNsec(mockNsec);
    });

    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    const signedEvent = await act(() => result.current.signEvent(mockEventTemplate));

    expect(finalizeEvent).toHaveBeenCalledWith(mockEventTemplate, expect.any(Uint8Array));
    expect(signedEvent.id).toBe('mockedId');
  });

  it('signEvent throws if not authenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider }); // starts as guest
    
    const mockEventTemplate = { kind: 1, content: 'test', tags: [], created_at: 123 };
    await act(async () => {
      await expect(result.current.signEvent(mockEventTemplate)).rejects.toThrow('No signer available');
    });
  });
});
