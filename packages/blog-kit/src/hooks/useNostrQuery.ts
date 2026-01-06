import { type Event, type Filter, SimplePool } from 'nostr-tools';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNostrstackConfig } from '../context';

export type UseNostrQueryOptions = {
  enabled?: boolean;
  relays?: string[];
  limit?: number;
  initialEvents?: Event[];
};

export type UseNostrQueryResult = {
  events: Event[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

// Global pool for shared connections
let globalPool: SimplePool | null = null;

function getGlobalPool() {
  if (!globalPool) {
    globalPool = new SimplePool();
  }
  return globalPool;
}

export function useNostrQuery(
  filters: Filter[],
  options: UseNostrQueryOptions = {}
): UseNostrQueryResult {
  const { enabled = true, relays, limit = 20, initialEvents = [] } = options;
  const cfg = useNostrstackConfig();
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Use a ref to track seen IDs to avoid duplicates
  const seenIds = useRef(new Set<string>(initialEvents.map((e) => e.id)));

  // Track the oldest event timestamp for pagination
  const oldestTimestamp = useRef<number | null>(null);

  const relayList = relays ?? cfg.relays ?? ['wss://relay.damus.io', 'wss://relay.snort.social'];

  const fetchEvents = useCallback(
    async (isLoadMore = false) => {
      if (!enabled || !relayList.length) return;

      setLoading(true);
      setError(null);

      try {
        const pool = getGlobalPool();

        const queryFilters = filters.map((f) => {
          const newFilter = { ...f, limit };
          if (isLoadMore && oldestTimestamp.current) {
            newFilter.until = oldestTimestamp.current - 1;
          }
          return newFilter;
        });

        const results = await pool.querySync(relayList, queryFilters as any);

        if (results.length === 0) {
          setHasMore(false);
        } else {
          const newEvents = results.filter((e) => !seenIds.current.has(e.id));
          newEvents.forEach((e) => seenIds.current.add(e.id));

          if (newEvents.length > 0) {
            setEvents((prev) => {
              const all = [...prev, ...newEvents].sort((a, b) => b.created_at - a.created_at);
              if (all.length > 0) {
                oldestTimestamp.current = all[all.length - 1].created_at;
              }
              return all;
            });
          }

          if (results.length < limit) {
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error('Nostr query failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        setLoading(false);
      }
    },
    [enabled, JSON.stringify(relayList), JSON.stringify(filters), limit]
  );

  // Initial fetch
  useEffect(() => {
    // Reset state when filters change
    setEvents(initialEvents);
    seenIds.current = new Set(initialEvents.map((e) => e.id));
    oldestTimestamp.current = null;
    setHasMore(true);

    if (enabled) {
      fetchEvents();
    }
  }, [fetchEvents, initialEvents]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchEvents(true);
    }
  }, [loading, hasMore, fetchEvents]);

  return {
    events,
    loading,
    error,
    hasMore,
    loadMore
  };
}
