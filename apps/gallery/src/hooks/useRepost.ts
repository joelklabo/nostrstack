import { useAuth } from '@nostrstack/blog-kit';
import { type Event } from 'nostr-tools';
import { useCallback, useState } from 'react';

import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

export function useRepost() {
  const { pubkey, signEvent } = useAuth();
  const { relays } = useRelays();
  const pool = useSimplePool();
  const [loading, setLoading] = useState(false);

  const repost = useCallback(async (event: Event): Promise<boolean> => {
    if (!pubkey || !signEvent) return false;
    
    setLoading(true);
    try {
      // NIP-18: Repost (Kind 6)
      // content: stringified original event
      // tags: e (event id), p (author pubkey)
      const template = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id, relays[0] || ''],
          ['p', event.pubkey],
        ],
        content: JSON.stringify(event),
      };

      const signed = await signEvent(template);
      await Promise.any(pool.publish(relays, signed));
      return true;
    } catch (err) {
      console.error('Failed to repost:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [pubkey, signEvent, relays, pool]);

  return { repost, loading };
}
