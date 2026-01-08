import { useNostrQuery, type UseNostrQueryOptions } from './useNostrQuery';

export type UseFeedOptions = UseNostrQueryOptions & {
  authors?: string[];
  kinds?: number[];
  search?: string; // For future NIP-50 support
};

export function useFeed(options: UseFeedOptions = {}) {
  const { authors, kinds = [1], ...queryOptions } = options;

  const filter = {
    kinds,
    ...(authors ? { authors } : {})
  };

  return useNostrQuery([filter], queryOptions);
}
