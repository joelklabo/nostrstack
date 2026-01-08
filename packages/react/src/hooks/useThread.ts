import { useNostrQuery, type UseNostrQueryOptions } from './useNostrQuery';

export function useThread(rootId: string, options: UseNostrQueryOptions = {}) {
  // Fetch root event + replies
  // This is a naive implementation. A proper thread fetcher would look for 'e' tags.
  // For now, we query for events tagging this root ID.

  return useNostrQuery(
    [
      { ids: [rootId] }, // The root event itself
      { '#e': [rootId] }, // Replies to it
      { '#r': [rootId] } // References to it (optional)
    ],
    options
  );
}
