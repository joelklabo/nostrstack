import type { Filter } from 'nostr-tools';
import { useCallback } from 'react';

import { getEventsByFilter, saveEvent } from '../cache/eventCache';
import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

export function useCachedEvent() {
  const pool = useSimplePool();
  const { relays } = useRelays();

  const get = useCallback(
    async (filter: Filter) => {
      // Try cache first
      try {
        const cached = await getEventsByFilter(filter);
        // If we found something relevant and sorted by created_at desc
        if (cached.length > 0) {
          // Sort to get latest - use spread to avoid mutating original
          const sorted = [...cached].sort((a, b) => b.created_at - a.created_at);
          return sorted[0];
        }
      } catch (e) {
        console.warn('Cache read failed', e);
      }

      // Fetch from network
      const event = await pool.get(relays, filter);
      if (event) {
        saveEvent(event).catch((e) => console.warn('Cache write failed', e));
      }
      return event;
    },
    [pool, relays]
  );

  return { get };
}
