import { type Event } from 'nostr-tools';
import { useMemo } from 'react';

import { useNostrQuery, type UseNostrQueryOptions } from './useNostrQuery';

export type UseZapsResult = {
  zaps: Event[];
  loading: boolean;
  error: string | null;
};

export function useZaps(
  target: { eventId?: string; pubkey?: string },
  options: UseNostrQueryOptions = {}
): UseZapsResult {
  const { eventId, pubkey } = target;

  const filters = useMemo(() => {
    const f = [];
    if (eventId) f.push({ kinds: [9735], '#e': [eventId] });
    if (pubkey) f.push({ kinds: [9735], '#p': [pubkey] });
    return f;
  }, [eventId, pubkey]);

  const { events, loading, error } = useNostrQuery(filters, {
    ...options,
    enabled: options.enabled !== false && filters.length > 0
  });

  // Filter out zaps that don't match our specific target if we queried both (unlikely usage but safe)
  // useNostrQuery merges results.
  // We can just return all events as they are 9735s.

  return {
    zaps: events,
    loading,
    error
  };
}
