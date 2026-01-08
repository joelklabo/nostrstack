import { useAuth } from '@nostrstack/react';
import type { Event } from 'nostr-tools';
import { useCallback, useEffect, useState } from 'react';

import { saveEvent } from '../cache/eventCache';
import { useCachedEvent } from './useCachedEvent';
import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

export function useMuteList() {
  const { pubkey, signEvent } = useAuth();
  const { relays } = useRelays();
  const pool = useSimplePool();
  const { get: getCached } = useCachedEvent();
  const [muted, setMuted] = useState<string[]>([]);
  const [muteEvent, setMuteEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMuteList = useCallback(async () => {
    if (!pubkey) {
      setMuted([]);
      setMuteEvent(null);
      return;
    }
    setLoading(true);
    try {
      const event = await getCached({ kinds: [10000], authors: [pubkey] });
      if (event) {
        setMuteEvent(event);
        const pTags = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
        setMuted(pTags);
      } else {
        setMuted([]);
        setMuteEvent(null);
      }
    } catch (e) {
      console.error('Failed to fetch mute list', e);
    } finally {
      setLoading(false);
    }
  }, [pubkey, relays, pool]);

  useEffect(() => {
    fetchMuteList();
  }, [fetchMuteList]);

  const mute = useCallback(async (targetPubkey: string) => {
    if (!pubkey) throw new Error('Not logged in');
    if (muted.includes(targetPubkey)) return;

    const newTags = muteEvent ? [...muteEvent.tags] : [];
    if (!newTags.some(t => t[0] === 'p' && t[1] === targetPubkey)) {
        newTags.push(['p', targetPubkey]);
    }

    const template = {
      kind: 10000,
      created_at: Math.floor(Date.now() / 1000),
      tags: newTags,
      content: muteEvent ? muteEvent.content : '',
    };

    const signed = await signEvent(template);
    await Promise.any(pool.publish(relays, signed));
    saveEvent(signed).catch(console.warn);
    setMuteEvent(signed);
    setMuted(newTags.filter(t => t[0] === 'p').map(t => t[1]));
  }, [pubkey, muted, muteEvent, signEvent, relays, pool]);

  const unmute = useCallback(async (targetPubkey: string) => {
    if (!pubkey || !muteEvent) return;
    
    const newTags = muteEvent.tags.filter(t => !(t[0] === 'p' && t[1] === targetPubkey));
    
    const template = {
      kind: 10000,
      created_at: Math.floor(Date.now() / 1000),
      tags: newTags,
      content: muteEvent.content,
    };

    const signed = await signEvent(template);
    await Promise.any(pool.publish(relays, signed));
    saveEvent(signed).catch(console.warn);
    setMuteEvent(signed);
    setMuted(newTags.filter(t => t[0] === 'p').map(t => t[1]));
  }, [pubkey, muteEvent, signEvent, relays, pool]);

  const isMuted = useCallback((targetPubkey: string) => muted.includes(targetPubkey), [muted]);

  return { muted, loading, mute, unmute, isMuted, refresh: fetchMuteList };
}
