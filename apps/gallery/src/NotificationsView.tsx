import { useAuth, useStats } from '@nostrstack/blog-kit';
import { type Event, type Filter, SimplePool } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PostItem } from './FeedView';
import { useRelays } from './hooks/useRelays';
import { type NotificationGroup, NotificationItem } from './ui/NotificationItem';

export function NotificationsView() {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { pubkey } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const seenIds = useRef(new Set<string>());
  const { incrementEvents } = useStats();

  useEffect(() => {
    if (!pubkey || relaysLoading) return;
    const pool = new SimplePool();
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const filter: Filter = { kinds: [1, 6, 7, 9735], '#p': [pubkey], limit: 50 };
    const sub = pool.subscribeMany(relayList, filter, {
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
    return () => {
      try {
        sub.close();
      } catch {
        // Ignore websocket close errors during teardown.
      }
      if (closeTimer == null) {
        closeTimer = globalThis.setTimeout(() => {
          closeTimer = null;
          try {
            pool.close(relayList);
          } catch {
            // Ignore websocket close errors during teardown.
          }
        }, 0);
      }
    };
  }, [pubkey, relayList, relaysLoading, incrementEvents]);

  const displayGroups = useMemo(() => {
    const groups: (NotificationGroup | Event)[] = [];
    const interactionGroups = new Map<string, NotificationGroup>();

    events.forEach(event => {
      if (event.kind === 1) {
        groups.push(event);
        return;
      }

      if (event.kind === 7 || event.kind === 9735) {
        const type = event.kind === 7 ? 'reaction' : 'zap';
        const targetEventId = event.tags.find(t => t[0] === 'e')?.[1];
        
        if (!targetEventId) {
          // If no target e-tag, just show as raw if it's kind 1, otherwise maybe ignore?
          // Task says Kind 1 is full PostItem.
          return;
        }

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
        // Keep the latest timestamp for the group
        if (event.created_at > group.timestamp) {
          group.timestamp = event.created_at;
        }
      }
    });

    return groups;
  }, [events]);

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
