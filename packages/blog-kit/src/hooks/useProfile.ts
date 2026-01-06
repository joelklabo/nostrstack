import { type Event } from 'nostr-tools';

import { useNostrQuery, type UseNostrQueryOptions } from './useNostrQuery';

export type UseProfileResult = {
  profile: Event | null;
  loading: boolean;
  error: string | null;
};

export function useProfile(pubkey: string, options: UseNostrQueryOptions = {}): UseProfileResult {
  const { events, loading, error } = useNostrQuery([{ kinds: [0], authors: [pubkey], limit: 1 }], {
    ...options,
    limit: 1
  });

  // Return the most recent profile event (kind 0 is replaceable, but we query for 1)
  // querySync returns list, we sort by created_at desc in useNostrQuery (ascending actually?)
  // useNostrQuery sorts ascending: a.created_at - b.created_at. So last item is newest.

  const profile = events.length > 0 ? events[events.length - 1] : null;

  return {
    profile,
    loading,
    error
  };
}
