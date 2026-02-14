import { useAuth } from '@nostrstack/react';
import type { Event } from 'nostr-tools';
import { useCallback, useEffect, useState } from 'react';

import { saveEvent } from '../cache/eventCache';
import { useCachedEvent } from './useCachedEvent';
import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

export function useContactList() {
  const { pubkey, signEvent } = useAuth();
  const { relays } = useRelays();
  const pool = useSimplePool();
  const { get: getCached } = useCachedEvent();
  const [contacts, setContacts] = useState<string[]>([]);
  const [contactEvent, setContactEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const event = await getCached({ kinds: [3], authors: [pubkey] });
      if (event) {
        setContactEvent(event);
        const pTags = event.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
        setContacts(pTags);
      } else {
        setContacts([]);
        setContactEvent(null);
      }
    } catch (e) {
      console.error('Failed to fetch contact list', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getCached reference is stable
  }, [pubkey, relays, pool]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const follow = useCallback(
    async (targetPubkey: string) => {
      if (!pubkey) throw new Error('Not logged in');
      if (contacts.includes(targetPubkey)) return;

      const newTags = contactEvent ? [...contactEvent.tags] : [];
      // Check if already exists (double safety)
      if (!newTags.some((t) => t[0] === 'p' && t[1] === targetPubkey)) {
        newTags.push(['p', targetPubkey, '', '']);
      }

      const template = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: contactEvent ? contactEvent.content : ''
      };

      const signed = await signEvent(template);
      try {
        await Promise.any(pool.publish(relays, signed));
      } catch {
        console.warn('[ContactList] Failed to publish contact list to all relays');
      }
      saveEvent(signed).catch(console.warn);
      setContactEvent(signed);
      setContacts(newTags.filter((t) => t[0] === 'p').map((t) => t[1]));
    },
    [pubkey, contacts, contactEvent, signEvent, relays, pool]
  );

  const unfollow = useCallback(
    async (targetPubkey: string) => {
      if (!pubkey || !contactEvent) return;

      const newTags = contactEvent.tags.filter((t) => !(t[0] === 'p' && t[1] === targetPubkey));

      const template = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: contactEvent.content
      };

      const signed = await signEvent(template);
      try {
        await Promise.any(pool.publish(relays, signed));
      } catch {
        console.warn('[ContactList] Failed to publish unfollow to all relays');
      }
      saveEvent(signed).catch(console.warn);
      setContactEvent(signed);
      setContacts(newTags.filter((t) => t[0] === 'p').map((t) => t[1]));
    },
    [pubkey, contactEvent, signEvent, relays, pool]
  );

  const isFollowing = useCallback(
    (targetPubkey: string) => contacts.includes(targetPubkey),
    [contacts]
  );

  return { contacts, loading, follow, unfollow, isFollowing, refresh: fetchContacts };
}
