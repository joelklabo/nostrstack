import type { Event, Filter } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

interface ZapInfo {
  /** Zapper's pubkey (who sent the zap) */
  senderPubkey: string;
  /** Amount in millisats (from bolt11) */
  amountMsats: number;
  /** Optional zap message */
  message?: string;
  /** Timestamp */
  createdAt: number;
  /** Original zap receipt event */
  event: Event;
}

interface UseTopZapsOptions {
  /** Event ID to fetch zaps for */
  eventId: string;
  /** Maximum number of top zaps to return */
  limit?: number;
  /** Disable fetching */
  enabled?: boolean;
}

/**
 * Parse amount from bolt11 invoice in zap receipt.
 * Bolt11 format: lnbc[amount][multiplier]...
 */
function parseBolt11Amount(bolt11: string): number {
  const match = bolt11.match(/^ln(?:bc|tb|tbs)(\d+)([munp])?/i);
  if (!match) return 0;

  const amount = parseInt(match[1], 10);
  const multiplier = match[2]?.toLowerCase();

  // Convert to millisats based on multiplier
  switch (multiplier) {
    case 'm': // milli-bitcoin (0.001 BTC)
      return amount * 100_000_000; // 1 mBTC = 100,000,000 msats
    case 'u': // micro-bitcoin (0.000001 BTC)
      return amount * 100_000; // 1 uBTC = 100,000 msats
    case 'n': // nano-bitcoin (0.000000001 BTC)
      return amount * 100; // 1 nBTC = 100 msats
    case 'p': // pico-bitcoin (0.000000000001 BTC)
      return amount / 10; // 1 pBTC = 0.1 msats
    default:
      // No multiplier means whole BTC (rare for Lightning)
      return amount * 100_000_000_000; // 1 BTC = 100,000,000,000 msats
  }
}

/**
 * Parse zap receipt event to extract zap info.
 */
function parseZapReceipt(event: Event): ZapInfo | null {
  try {
    // Get bolt11 invoice from tags
    const bolt11Tag = event.tags.find((t) => t[0] === 'bolt11');
    const bolt11 = bolt11Tag?.[1];
    if (!bolt11) return null;

    const amountMsats = parseBolt11Amount(bolt11);
    if (amountMsats === 0) return null;

    // Get sender pubkey from 'P' tag (uppercase P = zapper pubkey)
    // or from embedded 'description' tag which contains the zap request
    let senderPubkey = event.tags.find((t) => t[0] === 'P')?.[1];
    let message: string | undefined;

    // Try to get zapper info from the description (zap request)
    const descriptionTag = event.tags.find((t) => t[0] === 'description');
    if (descriptionTag?.[1]) {
      try {
        const zapRequest = JSON.parse(descriptionTag[1]) as Event;
        senderPubkey = senderPubkey || zapRequest.pubkey;
        message = zapRequest.content?.trim() || undefined;
      } catch {
        // Ignore parse errors
      }
    }

    if (!senderPubkey) return null;

    return {
      senderPubkey,
      amountMsats,
      message,
      createdAt: event.created_at,
      event
    };
  } catch {
    return null;
  }
}

/**
 * Hook to fetch top zaps for a specific event.
 */
export function useTopZaps({ eventId, limit = 3, enabled = true }: UseTopZapsOptions) {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const pool = useSimplePool();
  const [zaps, setZaps] = useState<ZapInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !eventId || relaysLoading) return;

    setLoading(true);
    seenIds.current.clear();
    const allZaps: ZapInfo[] = [];

    const filter: Filter = {
      kinds: [9735],
      '#e': [eventId],
      limit: 20 // Fetch more to find top zappers
    };

    let sub: { close: () => void } | undefined;

    try {
      sub = pool.subscribeMany(relayList, filter, {
        onevent(event) {
          if (seenIds.current.has(event.id)) return;
          seenIds.current.add(event.id);

          const zapInfo = parseZapReceipt(event);
          if (zapInfo) {
            allZaps.push(zapInfo);

            // Sort by amount descending and take top N
            const sorted = [...allZaps].sort((a, b) => b.amountMsats - a.amountMsats);
            const topZaps = sorted.slice(0, limit);
            const total = allZaps.reduce((sum, z) => sum + z.amountMsats, 0);

            setZaps(topZaps);
            setTotalAmount(total);
          }
        },
        oneose() {
          setLoading(false);
        }
      });
    } catch {
      setLoading(false);
    }

    // Timeout fallback
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      try {
        sub?.close();
      } catch {
        // Ignore close errors
      }
    };
  }, [eventId, enabled, relayList, relaysLoading, limit, pool]);

  // Memoize the return value
  const result = useMemo(
    () => ({
      zaps,
      loading,
      totalAmount,
      totalAmountSats: Math.floor(totalAmount / 1000),
      zapCount: zaps.length
    }),
    [zaps, loading, totalAmount]
  );

  return result;
}
