import { useAuth } from '@nostrstack/react';
import { type Event, type EventTemplate, SimplePool } from 'nostr-tools';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useRelays } from '../hooks/useRelays';
import { EmojiPicker } from './EmojiPicker';

interface EmojiReactionButtonProps {
  event: Event;
  className?: string;
}

/**
 * Enhanced reaction button with emoji picker.
 * Click for quick ❤️ reaction, or hold/right-click for emoji picker.
 */
export const EmojiReactionButton = memo(function EmojiReactionButton({
  event,
  className
}: EmojiReactionButtonProps) {
  const { pubkey, signEvent } = useAuth();
  const { relays } = useRelays();
  const [hasReacted, setHasReacted] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<number | null>(null);

  const relayTargets = useMemo(() => {
    const defaults = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];
    return relays.length > 0 ? relays : defaults;
  }, [relays]);

  const publishReaction = useCallback(
    async (emoji: string) => {
      if (!pubkey) {
        alert('You must be logged in to react.');
        return;
      }
      if (hasReacted || isPublishing) return;

      setHasReacted(true);
      setReactedEmoji(emoji);
      setIsPublishing(true);

      try {
        const reactionEventTemplate: EventTemplate = {
          kind: 7,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['e', event.id],
            ['p', event.pubkey]
          ],
          content: emoji
        };

        const signedReaction = await signEvent(reactionEventTemplate);

        const pool = new SimplePool();
        await Promise.any(pool.publish(relayTargets, signedReaction));
        pool.close(relayTargets);
      } catch (err) {
        console.error('Failed to publish reaction:', err);
        setHasReacted(false);
        setReactedEmoji(null);
      } finally {
        setIsPublishing(false);
      }
    },
    [pubkey, signEvent, event, relayTargets, hasReacted, isPublishing]
  );

  const handleClick = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Quick click = default heart reaction
    if (!showPicker) {
      publishReaction('❤️');
    }
  }, [publishReaction, showPicker]);

  const handleMouseDown = useCallback(() => {
    // Start long press timer to show picker
    longPressTimer.current = window.setTimeout(() => {
      setShowPicker(true);
    }, 500);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowPicker(true);
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      publishReaction(emoji);
    },
    [publishReaction]
  );

  const handlePickerClose = useCallback(() => {
    setShowPicker(false);
  }, []);

  return (
    <div className="emoji-reaction-wrapper">
      <button
        ref={buttonRef}
        className={`ns-btn ns-btn--ghost ns-btn--sm ns-action-btn ${className || ''} ${hasReacted ? 'active' : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        disabled={isPublishing || hasReacted}
        aria-label={hasReacted ? `Reacted with ${reactedEmoji}` : 'React to this post'}
        aria-pressed={hasReacted}
        aria-haspopup="listbox"
        aria-expanded={showPicker}
        title={hasReacted ? `Reacted: ${reactedEmoji}` : 'React (hold for more)'}
      >
        <span className="icon">{hasReacted && reactedEmoji ? reactedEmoji : '♡'}</span>
        <span className="label">{hasReacted ? 'Liked' : 'React'}</span>
      </button>

      <EmojiPicker
        isOpen={showPicker}
        onSelect={handleEmojiSelect}
        onClose={handlePickerClose}
        quickMode
      />
    </div>
  );
});
