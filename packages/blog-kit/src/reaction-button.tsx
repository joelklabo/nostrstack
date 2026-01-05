import { type Event, type EventTemplate, SimplePool } from 'nostr-tools';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { useNostrstackConfig } from './context';

interface ReactionButtonProps {
  event: Event; // The event to react to
  relays?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

export function ReactionButton({
  event,
  relays,
  className,
  style
}: ReactionButtonProps) {
  const { pubkey, signEvent } = useAuth();
  const cfg = useNostrstackConfig();
  const [hasReacted, setHasReacted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const relayTargets = useMemo(() => {
    const base = relays ?? cfg.relays ?? RELAYS;
    const cleaned = base.map((relay) => relay.trim()).filter(Boolean);
    return cleaned.length ? cleaned : RELAYS;
  }, [relays, cfg.relays]);

  // Check if we already reacted (optional, if we want to fetch state)
  // For v1, we just track local state for the session or if the user clicks it.
  // In a real app, we'd query for kind 7s from this user for this event.

  const handleReaction = useCallback(async () => {
    if (!pubkey) {
      alert('You must be logged in to react.');
      return;
    }
    if (hasReacted || isPublishing) return;

    setHasReacted(true); // Optimistic
    setIsPublishing(true);

    try {
      const reactionEventTemplate: EventTemplate = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id],
          ['p', event.pubkey]
        ],
        content: '+',
      };
      
      const signedReaction = await signEvent(reactionEventTemplate);
      
      const pool = new SimplePool();
      await Promise.any(pool.publish(relayTargets, signedReaction));
      pool.close(relayTargets);
    } catch (err) {
      console.error('Failed to publish reaction:', err);
      setHasReacted(false); // Rollback
    } finally {
      setIsPublishing(false);
    }
  }, [pubkey, signEvent, event, relayTargets, hasReacted, isPublishing]);

  return (
    <button 
      className={`action-btn reaction-btn ${className ?? ''} ${hasReacted ? 'active' : ''}`} 
      style={{
        ...style,
        color: hasReacted ? '#cf222e' : undefined,
        borderColor: hasReacted ? 'rgba(207, 34, 46, 0.4)' : undefined,
        background: hasReacted ? 'rgba(207, 34, 46, 0.08)' : undefined
      }}
      onClick={handleReaction} 
      disabled={isPublishing || hasReacted}
      aria-label={hasReacted ? 'Liked' : 'Like this note'}
      aria-pressed={hasReacted}
      aria-busy={isPublishing}
      title={hasReacted ? 'Liked' : 'Like'}
    >
      {hasReacted ? '♥' : '♡'}
    </button>
  );
}
