import type { SimplePool } from 'nostr-tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchNostrEventFromApi,
  getSearchRelays,
  NOTES_SEARCH_TIMEOUT_MS,
  SEARCH_RELAYS,
  searchNotes
} from './api';
import { relayMonitor } from './relayHealth';

function mockFetchResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function makeNostrEventResponse(payload: { id: string; relays?: string[] }) {
  return {
    target: { input: payload.id, type: 'event' as const },
    event: {
      id: payload.id,
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [['e', 'parent']],
      sig: 'test-sig',
      relays: payload.relays
    },
    author: { pubkey: 'test-pubkey', profile: null },
    references: {
      root: [],
      reply: [],
      mention: [],
      quote: [],
      address: [],
      profiles: []
    }
  };
}

describe('getSearchRelays', () => {
  const normalizedSearchRelays = SEARCH_RELAYS.map((relay) => `${relay}/`);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges user relays with search defaults and removes duplicates', () => {
    const relays = getSearchRelays(['wss://relay.custom', 'wss://relay.damus.io']);

    expect(relays).toEqual([
      'wss://relay.custom/',
      'wss://relay.damus.io/',
      ...normalizedSearchRelays.filter((relay) => relay !== 'wss://relay.damus.io/')
    ]);
  });

  it('filters unhealthy relays when healthy alternatives are available', () => {
    vi.spyOn(relayMonitor, 'isHealthy').mockImplementation((url: string) => {
      const normalized = url.endsWith('/') ? url : `${url}/`;
      return normalized !== 'wss://nos.lol/';
    });

    const relays = getSearchRelays(['wss://relay.custom']);

    expect(relays).toEqual(['wss://relay.custom/', ...normalizedSearchRelays]);
    expect(relays).not.toContain('wss://nos.lol/');
  });

  it('falls back to all relays when all candidates are marked unhealthy', () => {
    vi.spyOn(relayMonitor, 'isHealthy').mockReturnValue(false);

    const relays = getSearchRelays(['wss://relay.custom']);

    expect(relays).toEqual(['wss://relay.custom/', ...normalizedSearchRelays]);
  });
});

describe('fetchNostrEventFromApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds event endpoint URL without duplicate api segment when base URL already ends with /api', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(makeNostrEventResponse({ id: 'event-id-a' })));

    await fetchNostrEventFromApi({
      baseUrl: 'https://api.nostrstack.com/api/',
      id: 'event-id-a',
      timeoutMs: 1000
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.nostrstack.com/api/nostr/event/event-id-a?timeoutMs=1000'
    );
  });

  it('works with relative /api base URL and appends event endpoint path correctly', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse(makeNostrEventResponse({ id: 'event-id-b' })));

    await fetchNostrEventFromApi({
      baseUrl: '/api',
      id: 'event-id-b',
      relays: ['wss://relay.damus.io']
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/nostr/event/event-id-b?relays=wss%3A%2F%2Frelay.damus.io'
    );
  });
});

describe('searchNotes', () => {
  it(
    'throws when every relay times out',
    async () => {
      const pool = {
        querySync: vi.fn(() => new Promise(() => {}))
      } as unknown as SimplePool;

      await expect(searchNotes(pool, ['wss://relay.nostr.band'], 'nostr')).rejects.toThrow(
        /timed out/i
      );
    },
    NOTES_SEARCH_TIMEOUT_MS + 2_000
  );

  it('throws when every relay rejects with timeout errors', async () => {
    const pool = {
      querySync: vi
        .fn()
        .mockRejectedValueOnce(new Error('Request timed out after 10000ms'))
        .mockRejectedValueOnce(new Error('request timed out after 10000ms'))
    } as unknown as SimplePool;

    await expect(
      searchNotes(pool, ['wss://relay.nostr.band', 'wss://relay.damus.io'], 'nostr')
    ).rejects.toThrow(/timed out/i);
    expect(pool.querySync).toHaveBeenCalledTimes(2);
  });

  it('falls back to content filtering when relays reject search filters', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = {
      id: 'event-id-c',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 1000,
      content: 'I love nostr stack search',
      tags: [],
      sig: 'test-sig'
    };

    const querySync = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('NOTICE from wss://relay.nostr.band/: ERROR: bad req: unrecognised filter item')
      )
      .mockResolvedValueOnce([event]);

    const pool = { querySync } as unknown as SimplePool;

    const events = await searchNotes(pool, ['wss://relay.nostr.band'], 'nostr', 10);

    expect(events).toEqual([event]);
    expect(querySync).toHaveBeenCalledTimes(2);
    expect(querySync).toHaveBeenNthCalledWith(
      1,
      ['wss://relay.nostr.band'],
      { kinds: [1], search: 'nostr', limit: 10 },
      { maxWait: 10_000 }
    );
    expect(querySync).toHaveBeenNthCalledWith(
      2,
      ['wss://relay.nostr.band'],
      { kinds: [1], limit: 20 },
      { maxWait: 10_000 }
    );
    consoleSpy.mockRestore();
  });

  it('falls back to content filtering when relay failures are mixed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = {
      id: 'event-id-d',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 2_000,
      content: 'Search terms should still work in fallback mode',
      tags: [],
      sig: 'test-sig'
    };

    const querySync = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('NOTICE from wss://relay.nostr.band/: ERROR: bad req: unrecognised filter item')
      )
      .mockRejectedValueOnce(new Error('Request timed out after 10000ms'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event]);

    const pool = { querySync } as unknown as SimplePool;

    const events = await searchNotes(
      pool,
      ['wss://relay.nostr.band', 'wss://relay.damus.io'],
      'search',
      10
    );

    expect(events).toEqual([event]);
    expect(querySync).toHaveBeenCalledTimes(4);
    expect(querySync).toHaveBeenNthCalledWith(
      1,
      ['wss://relay.nostr.band'],
      { kinds: [1], search: 'search', limit: 10 },
      { maxWait: 10_000 }
    );
    expect(querySync).toHaveBeenNthCalledWith(
      2,
      ['wss://relay.damus.io'],
      { kinds: [1], search: 'search', limit: 10 },
      { maxWait: 10_000 }
    );
    expect(querySync).toHaveBeenNthCalledWith(
      3,
      ['wss://relay.nostr.band'],
      { kinds: [1], limit: 20 },
      { maxWait: 10_000 }
    );
    expect(querySync).toHaveBeenNthCalledWith(
      4,
      ['wss://relay.damus.io'],
      { kinds: [1], limit: 20 },
      { maxWait: 10_000 }
    );
    consoleSpy.mockRestore();
  });
});
