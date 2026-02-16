import { useAuth, useStats } from '@nostrstack/react';
import { NotificationSkeleton } from '@nostrstack/ui';
import { type Event, type Filter } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { saveEvents } from './cache/eventCache';
import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { useSimplePool } from './hooks/useSimplePool';
import { NostrEventCard } from './ui/NostrEventCard';
import { type NotificationGroup, NotificationItem } from './ui/NotificationItem';
import { VirtualizedList } from './ui/VirtualizedList';

type NotificationDisplayItem = NotificationGroup | Event;

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

    // Batch state to avoid excessive re-renders
    const pendingEvents: Event[] = [];
    let batchTimer: number | null = null;

    const flushBatch = () => {
      if (pendingEvents.length === 0) return;
      const batch = [...pendingEvents];
      pendingEvents.length = 0;

      // Save to cache asynchronously
      saveEvents(batch).catch((e) => console.warn('[Cache] Failed to save notifications:', e));

      setEvents((prev) => {
        const combined = [...prev, ...batch];
        const sorted = combined.sort((a, b) => b.created_at - a.created_at);
        return sorted.slice(0, 100);
      });
    };

    const scheduleBatch = () => {
      if (batchTimer !== null) return;
      batchTimer = window.setTimeout(() => {
        flushBatch();
        batchTimer = null;
      }, 300);
    };

    try {
      sub = pool.subscribeMany(relayList, filter, {
        onevent(event) {
          incrementEvents();
          if (!seenIds.current.has(event.id)) {
            seenIds.current.add(event.id);
            pendingEvents.push(event);
            scheduleBatch();
          }
        }
      });
    } catch {
      // ignore
    }
    return () => {
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        flushBatch();
      }
      try {
        sub?.close();
      } catch {
        // Ignore websocket close errors during teardown.
      }
    };
  }, [pubkey, relayList, relaysLoading, incrementEvents, pool]);

  const displayGroups = useMemo(() => {
    const filteredEvents = events.filter((e) => !isMuted(e.pubkey));
    const groups: (NotificationGroup | Event)[] = [];
    const interactionGroups = new Map<string, NotificationGroup>();

    filteredEvents.forEach((event) => {
      // Grouping logic
      let type: 'reaction' | 'zap' | 'mention' | null = null;
      if (event.kind === 7) type = 'reaction';
      if (event.kind === 9735) type = 'zap';
      if (event.kind === 1) type = 'mention';

      if (type) {
        const targetEventId = event.tags.find((t) => t[0] === 'e')?.[1];

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

    // Sort groups/events by timestamp descending - use spread to avoid mutating
    return [...groups].sort((a, b) => {
      const tsA = 'created_at' in a ? a.created_at : a.timestamp;
      const tsB = 'created_at' in b ? b.created_at : b.timestamp;
      return tsB - tsA;
    });
  }, [events, isMuted]);

  // Render a notification item for the virtualized list
  const renderNotificationItem = useCallback((item: NotificationDisplayItem) => {
    if ('kind' in item) {
      return (
        <div role="listitem">
          <NostrEventCard event={item} />
        </div>
      );
    }
    return (
      <div role="listitem">
        <NotificationItem group={item} />
      </div>
    );
  }, []);

  // Extract key for each notification item
  const getNotificationKey = useCallback((item: NotificationDisplayItem) => {
    return item.id;
  }, []);

  if (relaysLoading) {
    return (
      <section className="feed-stream" aria-label="Notifications loading" aria-busy={true}>
        <div
          style={{ marginBottom: '1rem', borderBottom: '1px solid var(--ns-color-text-default)' }}
          aria-hidden="true"
        >
          Loading notifications...
        </div>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0' }}
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading notifications...</span>
          {[1, 2, 3, 4, 5].map((i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="feed-stream" aria-label="Notifications">
      <h2
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)'
        }}
      >
        Notifications
      </h2>
      <div
        style={{ marginBottom: '1rem', borderBottom: '1px solid var(--ns-color-text-default)' }}
        aria-hidden="true"
      >
        Notifications
      </div>

      {displayGroups.length > 0 ? (
        <VirtualizedList
          items={displayGroups}
          rowHeightCacheKey="notifications-list-v1"
          getItemKey={getNotificationKey}
          renderItem={renderNotificationItem}
          ariaLabel="Notifications list"
        />
      ) : null}

      {events.length === 0 && (
        <div
          style={{ padding: '1rem', color: 'var(--ns-color-text-muted)' }}
          role="status"
          aria-live="polite"
        >
          No notifications yet. Interactions with your posts will appear here.
        </div>
      )}
    </section>
  );
}
