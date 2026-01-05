import { useAuth, useStats } from '@nostrstack/blog-kit';
import { type Event, type Filter } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PostItem } from './FeedView';
import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { useSimplePool } from './hooks/useSimplePool';
import { type NotificationGroup, NotificationItem } from './ui/NotificationItem';

export function NotificationsView() {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const pool = useSimplePool();
  const { pubkey } = useAuth();
  const { isMuted } = useMuteList();
  const [events, setEvents] = useState<Event[]>([]);
  const seenIds = useRef(new Set<string>());
  const { incrementEvents } = useStats();

  useEffect(() => {
    if (!pubkey || relaysLoading) return;
    const filter: Filter = { kinds: [1, 6, 7, 9735], '#p': [pubkey], limit: 50 };
    let sub: { close: () => void } | undefined;
    try {
      sub = pool.subscribeMany(relayList, filter, {
        onevent(event) {
          incrementEvents();
          if (!seenIds.current.has(event.id)) {
            seenIds.current.add(event.id);
            setEvents((prev) => {
              const next = [...prev, event].sort((a, b) => b.created_at - a.created_at);
              return next.slice(0, 100);
            });
          }
        }
      });
    } catch {
      // ignore
    }
    return () => {
      try {
        sub?.close();
      } catch {
        // Ignore websocket close errors during teardown.
      }
    };
  }, [pubkey, relayList, relaysLoading, incrementEvents, pool]);

  const displayGroups = useMemo(() => {
    const filteredEvents = events.filter(e => !isMuted(e.pubkey));
    const groups: (NotificationGroup | Event)[] = [];
    const interactionGroups = new Map<string, NotificationGroup>();

    filteredEvents.forEach(event => {
      // Grouping logic
      let type: 'reaction' | 'zap' | 'mention' | null = null;
      if (event.kind === 7) type = 'reaction';
      if (event.kind === 9735) type = 'zap';
      if (event.kind === 1) type = 'mention';

      if (type) {
        const targetEventId = event.tags.find(t => t[0] === 'e')?.[1];
        
        if (targetEventId) {
          const groupId = `${type}-${targetEventId}`;
          let group = interactionGroups.get(groupId);
          if (!group) {
            group = {
              id: groupId,
              type,
              events: [],
              targetEventId,
              timestamp: event.created_at
            };
            interactionGroups.set(groupId, group);
            groups.push(group);
          }
          group.events.push(event);
          if (event.created_at > group.timestamp) {
            group.timestamp = event.created_at;
          }
          return;
        }
      }
      
      // Fallback: not grouped or no target
      groups.push(event);
    });

    // Sort groups/events by timestamp descending
    return groups.sort((a, b) => {
      const tsA = 'created_at' in a ? a.created_at : a.timestamp;
      const tsB = 'created_at' in b ? b.created_at : b.timestamp;
      return tsB - tsA;
    });
  }, [events, isMuted]);

  if (relaysLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-fg-muted)' }} role="status">
        <span className="nostrstack-spinner" style={{ width: '24px', height: '24px', marginBottom: '1rem' }} aria-hidden="true" />
        <div style={{ fontSize: '0.9rem' }}>CONNECTING...</div>
      </div>
    );
  }

  return (
    <div className="feed-stream">
      <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--terminal-text)' }}>
        {' >'} INCOMING_TRANSMISSIONS...
      </div>
      
      {displayGroups.map((item) => {
        if ('kind' in item) {
          return <PostItem key={item.id} post={item} />;
        }
        return <NotificationItem key={item.id} group={item} />;
      })}

      {events.length === 0 && (
        <div style={{ padding: '1rem', color: 'var(--terminal-dim)' }}>NO_ACTIVITY_DETECTED</div>
      )}
    </div>
  );
}
