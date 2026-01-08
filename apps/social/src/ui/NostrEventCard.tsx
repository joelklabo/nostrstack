import {
  PaywalledContent,
  ReactionButton,
  ReplyModal,
  useAuth,
  ZapButton
} from '@nostrstack/react';
import MarkdownIt from 'markdown-it';
import type { Event } from 'nostr-tools';
import { memo, useCallback, useState } from 'react';

import { useRepost } from '../hooks/useRepost';
import { JsonView } from './JsonView';
import { ProfileLink } from './ProfileLink';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
});

type NostrEventCardProps = {
  event: Event;
  variant?: 'hero' | 'compact' | 'feed';
  authorLightningAddress?: string;
  apiBase?: string;
  enableRegtestPay?: boolean;
  onOpenThread?: (eventId: string) => void;
  className?: string;
};

export const NostrEventCard = memo(function NostrEventCard({
  event,
  variant = 'feed',
  authorLightningAddress,
  apiBase,
  enableRegtestPay,
  onOpenThread,
  className
}: NostrEventCardProps) {
  const [showJson, setShowJson] = useState(false);
  const [isZapped, setIsZapped] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const { repost, loading: repostLoading } = useRepost();
  const { pubkey } = useAuth();

  const handleRepost = useCallback(async () => {
    if (repostLoading || isReposted) return;
    const success = await repost(event);
    if (success) setIsReposted(true);
  }, [repost, event, repostLoading, isReposted]);

  const contentWarningTag = event.tags.find(
    (t) => t[0] === 'content-warning' || t[0] === 'sensitive'
  );
  const hasContentWarning = Boolean(contentWarningTag);
  const contentWarningReason = contentWarningTag?.[1] || 'Sensitive content';
  const [showContent, setShowContent] = useState(!hasContentWarning);

  const isPaywalled = event.tags.some((tag) => tag[0] === 'paywall');
  const paywallAmount = isPaywalled
    ? Number(event.tags.find((tag) => tag[0] === 'paywall')?.[1] || '0')
    : 0;
  const paywallItemId = event.id;

  const rootClasses = [
    'nostrstack-card',
    'nostrstack-event-card',
    `nostrstack-event-card--${variant}`,
    className
  ]
    .filter(Boolean)
    .join(' ');

  const renderContent = () => {
    if (hasContentWarning && !showContent) {
      return (
        <div
          className="nostrstack-callout"
          style={
            {
              '--nostrstack-callout-tone': 'var(--nostrstack-color-warning)'
            } as React.CSSProperties
          }
          role="region"
          aria-label="Content warning"
        >
          <div
            className="nostrstack-callout__title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>⚠️</span>
            Content Warning
          </div>
          <div className="nostrstack-callout__content">
            <p style={{ margin: '0 0 0.5rem' }}>{contentWarningReason}</p>
            <button
              className="nostrstack-btn nostrstack-btn--sm"
              onClick={() => setShowContent(true)}
            >
              Show Content
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="nostrstack-content"
        dangerouslySetInnerHTML={{ __html: md.render(event.content) }}
        role="article"
        aria-label="Post content"
      />
    );
  };

  return (
    <article
      className={rootClasses}
      tabIndex={0}
      aria-label={`Post by ${event.pubkey.slice(0, 8)}`}
    >
      <header className="nostrstack-event-card__header">
        <div className="nostrstack-event-card__meta">
          <ProfileLink
            pubkey={event.pubkey}
            label={`${event.pubkey.slice(0, 8)}...`}
            title={event.pubkey}
            className="nostrstack-profile-link"
          />
          <span className="nostrstack-separator" aria-hidden="true">
            •
          </span>
          <time
            className="nostrstack-timestamp"
            dateTime={new Date(event.created_at * 1000).toISOString()}
          >
            {new Date(event.created_at * 1000).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            })}
          </time>
        </div>

        {variant !== 'compact' && <div className="nostrstack-badge">Kind {event.kind}</div>}
      </header>

      <div className="nostrstack-event-card__body">
        {isPaywalled ? (
          <PaywalledContent
            itemId={paywallItemId}
            amountSats={paywallAmount}
            apiBase={apiBase ?? 'http://localhost:3001'}
            host={import.meta.env.VITE_NOSTRSTACK_HOST ?? 'localhost'}
            unlockedContent={renderContent()}
            lockedContent={
              <div className="nostrstack-callout">
                <div className="nostrstack-callout__title">Premium Content</div>
                <div className="nostrstack-callout__content">
                  This content requires a payment of {paywallAmount} sats.
                </div>
              </div>
            }
          />
        ) : (
          renderContent()
        )}
      </div>

      <div className="nostrstack-event-card__actions" role="group" aria-label="Post actions">
        <ReactionButton event={event} />
        <ZapButton
          event={event}
          authorLightningAddress={authorLightningAddress}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
          onZapSuccess={() => setIsZapped(true)}
          className={isZapped ? 'zapped' : ''}
        />
        <button
          className="nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-action-btn"
          onClick={() => setIsReplying(true)}
          aria-label="Reply to this post"
        >
          <span className="icon">💬</span>
          <span className="label">Reply</span>
        </button>
        {onOpenThread && (
          <button
            className="nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-action-btn"
            onClick={() => onOpenThread(event.id)}
            aria-label="View thread"
          >
            <span className="icon">🧵</span>
            <span className="label">Thread</span>
          </button>
        )}
        {pubkey && (
          <button
            className={`nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-action-btn ${isReposted ? 'active' : ''}`}
            onClick={handleRepost}
            disabled={repostLoading || isReposted}
            aria-label={isReposted ? 'Reposted' : 'Repost this post'}
          >
            <span className="icon">↻</span>
            <span className="label">
              {repostLoading ? '...' : isReposted ? 'Reposted' : 'Repost'}
            </span>
          </button>
        )}

        <button
          className="nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-action-btn"
          onClick={() => setShowJson(!showJson)}
          style={{ marginLeft: 'auto' }}
          aria-label={showJson ? 'Hide source' : 'View source'}
        >
          <span className="icon">{showJson ? '👁️‍🗨️' : '👁️'}</span>
        </button>
      </div>

      {showJson && (
        <div className="nostrstack-event-card__json">
          <JsonView value={event} title={`Event ID: ${event.id.slice(0, 8)}...`} />
        </div>
      )}

      <ReplyModal isOpen={isReplying} onClose={() => setIsReplying(false)} parentEvent={event} />
    </article>
  );
});
