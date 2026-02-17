import { type Event, type Filter, SimplePool } from 'nostr-tools';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNostrstackConfig } from '../context';

// Stable empty array to prevent unnecessary effect re-runs
const EMPTY_EVENTS: Event[] = [];
const DEFAULT_QUERY_TIMEOUT_MS = 8_000;

type RelayQueryResult = {
  failureReason?: string;
  events: Event[];
};

function isNonFailureCloseReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  return (
    normalized === 'closed' ||
    normalized === 'closed by caller' ||
    normalized.startsWith('closed automatically on eose')
  );
}

function hasFailureReason(reasons: string[]): string | undefined {
  return reasons.find((reason) => !isNonFailureCloseReason(reason));
}

async function queryRelay(
  pool: SimplePool,
  relayUrl: string,
  filter: Filter
): Promise<RelayQueryResult> {
  return new Promise<RelayQueryResult>((resolve) => {
    const events: Event[] = [];
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (events: Event[], failureReason?: string) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ events, failureReason });
    };

    try {
      const closer = pool.subscribeEose([relayUrl], filter, {
        maxWait: DEFAULT_QUERY_TIMEOUT_MS,
        onevent: (event) => events.push(event),
        onclose: (reasons = []) => {
          finish(events, hasFailureReason(reasons));
        }
      });

      timer = setTimeout(() => {
        closer.close('timeout');
      }, DEFAULT_QUERY_TIMEOUT_MS + 1_000);
    } catch (err) {
      finish([], err instanceof Error ? err.message : 'failed to subscribe to relay');
    }
  });
}

/**
 * Options for the useNostrQuery hook.
 */
export type UseNostrQueryOptions = {
  /** Whether the query should execute automatically. Defaults to true. */
  enabled?: boolean;
  /** List of relay URLs to query. Defaults to configured relays or fallbacks. */
  relays?: string[];
  /** Maximum number of events to fetch per page. Defaults to 20. */
  limit?: number;
  /** Initial events to seed the state with. */
  initialEvents?: Event[];
};

/**
 * Result of the useNostrQuery hook.
 */
export type UseNostrQueryResult = {
  /** List of unique events matching the filter, sorted by created_at descending. */
  events: Event[];
  /** Whether a query is currently in progress. */
  loading: boolean;
  /** Error message if the query failed. */
  error: string | null;
  /** Whether there are likely more events to fetch (based on limit). */
  hasMore: boolean;
  /** Function to load the next page of events. */
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

/**
 * A hook to query Nostr events from multiple relays with pagination and deduplication.
 *
 * @param filters - List of Nostr filters to apply.
 * @param options - Configuration options.
 * @returns Object containing events, loading state, error, and pagination controls.
 */
export function useNostrQuery(
  filters: Filter[],
  options: UseNostrQueryOptions = {}
): UseNostrQueryResult {
  const { enabled = true, relays, limit = 20, initialEvents = EMPTY_EVENTS } = options;
  const cfg = useNostrstackConfig();
  const reportRelayFailure = cfg.onRelayFailure;
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

        const queryFilters = filters.map((f): Filter => {
          const newFilter = { ...f, limit };
          if (isLoadMore && oldestTimestamp.current) {
            newFilter.until = oldestTimestamp.current - 1;
          }
          return newFilter;
        });

        const queryFilter = async (filter: Filter) => {
          const relayResults = await Promise.all(
            relayList.map((relay) => queryRelay(pool, relay, filter))
          );

          const failures: string[] = [];
          const relayEvents: Event[] = [];
          relayResults.forEach((result, relayIndex) => {
            relayEvents.push(...result.events);
            if (result.failureReason) {
              failures.push(result.failureReason);
              if (reportRelayFailure) {
                reportRelayFailure(relayList[relayIndex]);
              }
            }
          });

          return { failures, relayEvents };
        };

        // Query each filter separately and merge results
        const perFilterResults = await Promise.all(queryFilters.map(queryFilter));
        const resultArrays = perFilterResults.map((item) => item.relayEvents);
        const allFailures = perFilterResults.flatMap((item) => item.failures);
        const results = resultArrays.flat();

        const fetchedOldestTimestamp = results.length
          ? results.reduce<number | null>((min, event) => {
              if (typeof event.created_at !== 'number') return min;
              return min === null ? event.created_at : Math.min(min, event.created_at);
            }, null)
          : null;

        if (results.length === 0 && relayList.length > 0 && allFailures.length > 0) {
          setError(typeof allFailures[0] === 'string' ? allFailures[0] : 'Failed to fetch events');
          setHasMore(false);
        } else if (results.length === 0) {
          setHasMore(false);
        } else {
          const newEvents = results.filter((e) => !seenIds.current.has(e.id));
          newEvents.forEach((e) => seenIds.current.add(e.id));
          const duplicateOnlyPage = isLoadMore && newEvents.length === 0;

          if (fetchedOldestTimestamp !== null) {
            const previousOldest = oldestTimestamp.current;
            if (!isLoadMore || previousOldest === null) {
              oldestTimestamp.current = fetchedOldestTimestamp;
            } else if (fetchedOldestTimestamp < previousOldest) {
              oldestTimestamp.current = fetchedOldestTimestamp;
            } else if (duplicateOnlyPage) {
              setHasMore(false);
            }
          }

          if (newEvents.length > 0) {
            setEvents((prev) => {
              const combined = [...prev, ...newEvents];
              const seen = new Set<string>();
              const unique: Event[] = [];
              for (const event of combined) {
                if (!seen.has(event.id)) {
                  seen.add(event.id);
                  unique.push(event);
                }
              }
              unique.sort((a, b) => b.created_at - a.created_at);
              if (unique.length > 0) {
                oldestTimestamp.current = unique[unique.length - 1].created_at;
              }
              return unique;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- JSON.stringify for deep comparison of filters and relayList
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enabled is captured via fetchEvents callback deps
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
