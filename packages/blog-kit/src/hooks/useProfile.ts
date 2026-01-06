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

  // Return the most recent profile event (kind 0 is replaceable)
  // useNostrQuery sorts descending (newest first)
  const profile = events.length > 0 ? events[0] : null;

  return {
    profile,
    loading,
    error
  };
}
