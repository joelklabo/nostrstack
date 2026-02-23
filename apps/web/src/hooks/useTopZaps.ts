import { useNostrstackConfig } from '@nostrstack/react';
import { useEffect, useMemo, useState } from 'react';

import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';
import { zapBatcher, type ZapData, type ZapInfo } from './zapBatcher';

// Re-export types for consumers
export type { ZapInfo };

interface UseTopZapsOptions {
  /** Event ID to fetch zaps for */
  eventId: string;
  /** Maximum number of top zaps to return */
  limit?: number;
  /** Disable fetching */
  enabled?: boolean;
}

/**
 * Hook to fetch top zaps for a specific event.
 *
 * Uses a batched subscription approach to avoid N+1 subscription issues.
 * Instead of each component opening its own WebSocket subscription,
 * requests are batched together into a single subscription that fetches
 * zaps for multiple events at once.
 */
export function useTopZaps({ eventId, limit = 3, enabled = true }: UseTopZapsOptions) {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const pool = useSimplePool();
  const { onRelayFailure } = useNostrstackConfig();
  const [zapData, setZapData] = useState<ZapData>({
    zaps: [],
    totalAmount: 0,
    loading: false
  });

  // Configure the batcher with pool and relays
  useEffect(() => {
    if (!relaysLoading && relayList.length > 0) {
      zapBatcher.configureWithFailureCallback(pool, relayList, onRelayFailure);
    }
  }, [pool, relayList, relaysLoading, onRelayFailure]);

  // Subscribe to zap data through the batcher
  useEffect(() => {
    if (!enabled || !eventId || relaysLoading) {
      setZapData({ zaps: [], totalAmount: 0, loading: false });
      return;
    }

    // Subscribe to batched zap data
    const unsubscribe = zapBatcher.subscribe(eventId, (data) => {
      setZapData(data);
    });

    return () => {
      unsubscribe();
    };
  }, [eventId, enabled, relaysLoading]);

  // Memoize the return value with limit applied
  const result = useMemo(() => {
    const topZaps = zapData.zaps.slice(0, limit);
    return {
      zaps: topZaps,
      loading: zapData.loading,
      totalAmount: zapData.totalAmount,
      totalAmountSats: Math.floor(zapData.totalAmount / 1000),
      zapCount: zapData.zaps.length
    };
  }, [zapData, limit]);

  return result;
}
