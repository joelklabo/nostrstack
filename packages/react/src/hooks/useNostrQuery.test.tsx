import { act, renderHook, waitFor } from '@testing-library/react';
import type { Event, Filter } from 'nostr-tools';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NostrstackProvider } from '../context';
import { useNostrQuery } from './useNostrQuery';

const querySyncMock = vi.fn();

vi.mock('nostr-tools', async (importOriginal) => {
  const mod = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>;
  return {
    ...mod,
    SimplePool: vi.fn(() => ({
      querySync: querySyncMock
    }))
  };
});

function makeEvent(id: string, createdAt: number): Event {
  return {
    id,
    kind: 1,
    pubkey: 'pubkey',
    created_at: createdAt,
    content: '',
    tags: [],
    sig: 'signature'
  };
}

describe('useNostrQuery pagination', () => {
  const relays = ['wss://relay.test'];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrstackProvider relays={relays}>{children}</NostrstackProvider>
  );

  beforeEach(() => {
    querySyncMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('advances pagination with overlapping pages and stops duplicate-only loops', async () => {
    querySyncMock
      .mockResolvedValueOnce([makeEvent('event-1', 300), makeEvent('event-2', 250)])
      .mockResolvedValueOnce([makeEvent('event-2', 250), makeEvent('event-1', 300)]);

    const { result } = renderHook(
      () => useNostrQuery([{ kinds: [1], limit: 2 }], { relays, limit: 2 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.events).toHaveLength(2);
    });

    expect(querySyncMock).toHaveBeenCalledTimes(1);

    const firstFilter = querySyncMock.mock.calls[0][1] as Filter;
    expect(firstFilter.until).toBeUndefined();

    await act(async () => {
      result.current.loadMore();
      await Promise.resolve();
    });

    await waitFor(() => expect(querySyncMock).toHaveBeenCalledTimes(2));

    expect(result.current.events).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);

    const secondFilter = querySyncMock.mock.calls[1][1] as Filter;
    expect(secondFilter.until).toBe(249);

    await act(async () => {
      result.current.loadMore();
      await Promise.resolve();
    });

    expect(querySyncMock).toHaveBeenCalledTimes(2);
  });
});
