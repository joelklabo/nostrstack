import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSearchRelays, SEARCH_RELAYS } from './api';
import { relayMonitor } from './relayHealth';

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
