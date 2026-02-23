import { type Event, nip19 } from 'nostr-tools';
import { useMemo } from 'react';

import { navigateTo } from '../utils/navigation';
import { ProfileLink } from './ProfileLink';

export type NotificationGroup = {
  id: string; // Grouping ID (e.g. target event ID)
  type: 'reaction' | 'zap' | 'mention';
  events: Event[];
  targetEventId?: string;
  timestamp: number;
  isRead?: boolean;
};

function getRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function NotificationItem({ group }: { group: NotificationGroup }) {
  const targetId =
    group.targetEventId || (group.type === 'mention' ? group.events[0]?.id : undefined);

  const authors = useMemo(() => {
    const pubkeys = Array.from(new Set(group.events.map((e) => e.pubkey)));
    return pubkeys.slice(0, 2);
  }, [group.events]);

  const othersCount = useMemo(() => {
    const pubkeys = new Set(group.events.map((e) => e.pubkey));
    return Math.max(0, pubkeys.size - authors.length);
  }, [group.events, authors]);

  const handleNotificationClick = () => {
    if (targetId) {
      try {
        const noteId = nip19.noteEncode(targetId);
        navigateTo(`/nostr/${noteId}`);
      } catch {
        navigateTo(`/nostr/${targetId}`);
      }
    }
  };

  const renderIcon = () => {
    switch (group.type) {
      case 'reaction':
        return '❤️';
      case 'zap':
        return '⚡';
      case 'mention':
        return '💬';
      default:
        return '🔔';
    }
  };

  const renderActionText = () => {
    switch (group.type) {
      case 'reaction':
        return ` liked your post`;
      case 'zap': {
        const totalSats = group.events.reduce((sum, e) => {
          const amountTag = e.tags.find((t) => t[0] === 'amount');
          return sum + (amountTag ? Math.floor(Number(amountTag[1]) / 1000) : 0);
        }, 0);
        return ` zapped your post (${totalSats} sats)`;
      }
      case 'mention':
        return ` mentioned you`;
      default:
        return ` interacted with you`;
    }
  };

  const authorLabel = authors.map((pk) => pk.slice(0, 8)).join(', ');
  const othersLabel =
    othersCount > 0 ? ` and ${othersCount} other${othersCount > 1 ? 's' : ''}` : '';
  const actionLabel = `${authorLabel}${othersLabel}${renderActionText()}`.trim();
  const timeId = `notification-time-${group.id}`;

  const isRead = group.isRead ?? false;

  return (
    <button
      type="button"
      className={`notification-item notification-item--compact ${isRead ? 'notification-item--read' : 'notification-item--unread'}`}
      onClick={handleNotificationClick}
      disabled={!targetId}
      aria-label={targetId ? `Open notification: ${actionLabel}` : actionLabel}
      aria-describedby={timeId}
    >
      {!isRead && <span className="notification-unread-dot" aria-label="Unread" />}
      <span className="notification-icon" aria-hidden="true">
        {renderIcon()}
      </span>
      <span className="notification-content">
        {authors.map((pk, idx) => (
          <span key={pk}>
            <ProfileLink
              pubkey={pk}
              label={`${pk.slice(0, 8)}`}
              preferLabel
              className="notification-author"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
            {idx < authors.length - 1 ? ', ' : ''}
          </span>
        ))}
        {othersCount > 0 && (
          <span className="notification-others">
            {' '}
            and {othersCount} other{othersCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="notification-action">{renderActionText()}</span>
      </span>
      <time
        className="notification-time"
        id={timeId}
        dateTime={new Date(group.timestamp * 1000).toISOString()}
      >
        {getRelativeTime(group.timestamp)}
      </time>
    </button>
  );
}
