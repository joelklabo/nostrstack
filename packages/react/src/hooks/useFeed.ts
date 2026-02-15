import { useNostrQuery, type UseNostrQueryOptions } from './useNostrQuery';

export type UseFeedOptions = UseNostrQueryOptions & {
  authors?: string[];
  kinds?: number[];
  search?: string; // For future NIP-50 support
  since?: number; // For time-filtered feeds (e.g., trending)
};

export function useFeed(options: UseFeedOptions = {}) {
  const { authors, kinds = [1], since, ...queryOptions } = options;

  const filter: Record<string, unknown> = {
    kinds,
    ...(authors ? { authors } : {})
  };

  if (since) {
    filter.since = since;
  }

  return useNostrQuery([filter as never], queryOptions);
}
