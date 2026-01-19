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
};

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

  return (
    <button
      type="button"
      className="notification-item"
      onClick={handleNotificationClick}
      disabled={!targetId}
      aria-label={targetId ? `Open notification: ${actionLabel}` : actionLabel}
      aria-describedby={timeId}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1rem',
        borderBottom: '1px solid var(--ns-color-border-strong)',
        cursor: targetId ? 'pointer' : 'default',
        border: 'none',
        background: 'transparent',
        width: '100%',
        textAlign: 'left',
        font: 'inherit'
      }}
    >
      <div
        className="notification-icon"
        style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}
        aria-hidden="true"
      >
        {renderIcon()}
      </div>
      <div className="notification-content" style={{ flex: 1 }}>
        <div
          className="notification-text"
          style={{ fontSize: '0.95rem', color: 'var(--ns-color-text-default)' }}
        >
          {authors.map((pk, idx) => (
            <span key={pk}>
              <ProfileLink
                pubkey={pk}
                label={`${pk.slice(0, 8)}`}
                style={{
                  fontWeight: 600,
                  color: 'var(--ns-color-text-default)',
                  textDecoration: 'none'
                }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
              {idx < authors.length - 1 ? ', ' : ''}
            </span>
          ))}
          {othersCount > 0 && (
            <span>
              {' '}
              and {othersCount} other{othersCount > 1 ? 's' : ''}
            </span>
          )}
          <span style={{ color: 'var(--ns-color-text-muted)' }}>{renderActionText()}</span>
        </div>
        <div
          className="notification-time"
          id={timeId}
          style={{
            fontSize: '0.75rem',
            color: 'var(--ns-color-text-subtle)',
            marginTop: '0.25rem'
          }}
        >
          {new Date(group.timestamp * 1000).toLocaleString()}
        </div>
      </div>
    </button>
  );
}
