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

    expect(relays).toEqual(['wss://relay.custom/', ...normalizedSearchRelays]);
  });

  it('filters relays known to reject search filter key', () => {
    const relays = getSearchRelays([
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol'
    ]);

    expect(relays).not.toContain('wss://relay.damus.io/');
    expect(relays).not.toContain('wss://nos.lol/');
    expect(relays).not.toContain('wss://relay.primal.net/');
    expect(relays).toEqual([...normalizedSearchRelays]);
  });

  it('filters unsupported relays by hostname regardless of protocol or path variant', () => {
    const relays = getSearchRelays([
      'ws://relay.damus.io',
      'wss://nos.lol/custom/path',
      'WSS://relay.primal.net'
    ]);

    expect(relays).not.toContain('ws://relay.damus.io/');
    expect(relays).not.toContain('wss://nos.lol/custom/path');
    expect(relays).not.toContain('wss://relay.primal.net/');
    expect(relays).toEqual([...normalizedSearchRelays]);
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

  it('returns empty list when all candidates are marked unhealthy', () => {
    vi.spyOn(relayMonitor, 'isHealthy').mockReturnValue(false);

    const relays = getSearchRelays(['wss://relay.custom']);

    expect(relays).toEqual([]);
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

  it('surfaces requestId and client-validation marker on 4xx API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_id',
          message: 'invalid event id',
          requestId: 'req-validate-1'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      fetchNostrEventFromApi({
        baseUrl: '/api',
        id: 'not-a-valid-id'
      })
    ).rejects.toThrow(/client_validation; requestId=req-validate-1/);
  });

  it('surfaces requestId and backend marker on 5xx API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'timeout',
          message: 'Upstream timeout',
          requestId: 'req-backend-1'
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      fetchNostrEventFromApi({
        baseUrl: '/api',
        id: 'event-id-c'
      })
    ).rejects.toThrow(/backend; requestId=req-backend-1/);
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

  it('throws timeout when no results are returned and at least one relay times out', async () => {
    const pool = {
      querySync: vi
        .fn()
        .mockRejectedValueOnce(new Error('Request timed out after 10000ms'))
        .mockResolvedValueOnce([])
    } as unknown as SimplePool;

    await expect(
      searchNotes(pool, ['wss://relay.nostr.band', 'wss://relay.damus.io'], 'nostr')
    ).resolves.toEqual([]);
    expect(pool.querySync).toHaveBeenCalledTimes(2);
  });

  it('uses content filtering without server-side search filter', async () => {
    const event = {
      id: 'event-id-c',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 1000,
      content: 'I love nostr stack search',
      tags: [],
      sig: 'test-sig'
    };

    const querySync = vi.fn().mockResolvedValueOnce([event]);

    const pool = { querySync } as unknown as SimplePool;

    const events = await searchNotes(pool, ['wss://relay.nostr.band'], 'nostr', 10);

    expect(events).toEqual([event]);
    expect(querySync).toHaveBeenCalledTimes(1);
    expect(querySync).toHaveBeenNthCalledWith(
      1,
      ['wss://relay.nostr.band'],
      { kinds: [1], limit: 20 },
      { maxWait: 15_000 }
    );
  });

  it('uses content filtering and filters results by query', async () => {
    const matchingEvent = {
      id: 'event-id-e',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 3_000,
      content: 'nostr keyword in content',
      tags: [],
      sig: 'test-sig'
    };
    const nonMatchingEvent = {
      id: 'event-id-f',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 2_000,
      content: 'something else entirely',
      tags: [],
      sig: 'test-sig'
    };

    const querySync = vi.fn().mockResolvedValueOnce([matchingEvent, nonMatchingEvent]);

    const pool = { querySync } as unknown as SimplePool;

    const events = await searchNotes(pool, ['wss://relay.nostr.band'], 'nostr', 10);

    expect(events).toEqual([matchingEvent]);
    expect(querySync).toHaveBeenCalledTimes(1);
    expect(querySync).toHaveBeenNthCalledWith(
      1,
      ['wss://relay.nostr.band'],
      { kinds: [1], limit: 20 },
      { maxWait: 15_000 }
    );
  });

  it('queries multiple relays and merges results with content filtering', async () => {
    const event1 = {
      id: 'event-id-d',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 2_000,
      content: 'search term in first event',
      tags: [],
      sig: 'test-sig'
    };
    const event2 = {
      id: 'event-id-g',
      kind: 1,
      pubkey: 'test-pubkey',
      created_at: 1_000,
      content: 'search term in second event',
      tags: [],
      sig: 'test-sig'
    };

    const querySync = vi.fn().mockResolvedValueOnce([event1]).mockResolvedValueOnce([event2]);

    const pool = { querySync } as unknown as SimplePool;

    const events = await searchNotes(
      pool,
      ['wss://relay.nostr.band', 'wss://relay.damus.io'],
      'search',
      10
    );

    expect(events).toEqual([event1, event2]);
    expect(querySync).toHaveBeenCalledTimes(2);
    expect(querySync).toHaveBeenNthCalledWith(
      1,
      ['wss://relay.nostr.band'],
      { kinds: [1], limit: 20 },
      { maxWait: 15_000 }
    );
    expect(querySync).toHaveBeenNthCalledWith(
      2,
      ['wss://relay.damus.io'],
      { kinds: [1], limit: 20 },
      { maxWait: 15_000 }
    );
  });
});
