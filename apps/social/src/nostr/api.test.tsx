import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNostrEventFromApi, getSearchRelays, SEARCH_RELAYS } from './api';
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
      ...normalizedSearchRelays.filter((relay) => relay !== 'wss://relay.damus.io/'),
      'wss://nos.lol/',
      'wss://relay.primal.net/'
    ]);
  });

  it('filters unhealthy relays when healthy alternatives are available', () => {
    vi.spyOn(relayMonitor, 'isHealthy').mockImplementation(
      (url: string) => !url.includes('nos.lol')
    );

    const relays = getSearchRelays(['wss://relay.custom']);

    expect(relays).toEqual([
      'wss://relay.custom/',
      ...normalizedSearchRelays,
      'wss://relay.primal.net/'
    ]);
    expect(relays).not.toContain('wss://nos.lol/');
  });

  it('falls back to all relays when all candidates are marked unhealthy', () => {
    vi.spyOn(relayMonitor, 'isHealthy').mockReturnValue(false);

    const relays = getSearchRelays(['wss://relay.custom']);

    expect(relays).toEqual([
      'wss://relay.custom/',
      ...normalizedSearchRelays,
      'wss://nos.lol/',
      'wss://relay.primal.net/'
    ]);
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
