import { useAuth, useStats } from '@nostrstack/blog-kit';
import { type Event, SimplePool } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

import { PostItem } from './FeedView';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

export function NotificationsView() {
  const { pubkey } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const seenIds = useRef(new Set<string>());
  const { incrementEvents } = useStats();

  useEffect(() => {
    if (!pubkey) return;
    const pool = new SimplePool();
    let closeTimer: number | null = null;
    const filter = { kinds: [1, 6, 7, 9735], '#p': [pubkey], limit: 50 };
    const sub = pool.subscribeMany(RELAYS, filter, {
      onevent(event) {
        incrementEvents();
        if (!seenIds.current.has(event.id)) {
          seenIds.current.add(event.id);
          setEvents((prev) => {
            const next = [...prev, event].sort((a, b) => b.created_at - a.created_at);
            return next.slice(0, 50);
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
            pool.close(RELAYS);
          } catch {
            // Ignore websocket close errors during teardown.
          }
        }, 0);
      }
    };
  }, [pubkey]);

  return (
    <div className="feed-stream">
      <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--terminal-text)' }}>
        {' >'} INCOMING_TRANSMISSIONS...
      </div>
      {events.map((event) => (
        <PostItem key={event.id} post={event} />
      ))}
      {events.length === 0 && (
        <div style={{ padding: '1rem', color: 'var(--terminal-dim)' }}>NO_ACTIVITY_DETECTED</div>
      )}
    </div>
  );
}
