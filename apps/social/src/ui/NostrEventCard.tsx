import { PaywalledContent, ReplyModal, useAuth, ZapButton } from '@nostrstack/react';
import MarkdownIt from 'markdown-it';
import type { Event } from 'nostr-tools';
import { memo, useCallback, useState } from 'react';

import { useRepost } from '../hooks/useRepost';
import { EmojiReactionButton } from './EmojiReactionButton';
import { JsonView } from './JsonView';
import { LinkPreviews } from './LinkPreview';
import { ProfileLink } from './ProfileLink';
import { TopZaps } from './TopZaps';

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

  const rootClasses = ['ns-card', 'ns-event-card', `ns-event-card--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  const renderContent = () => {
    if (hasContentWarning && !showContent) {
      return (
        <div
          className="ns-callout"
          style={
            {
              '--ns-callout-tone': 'var(--ns-color-warning)'
            } as React.CSSProperties
          }
          role="region"
          aria-label="Content warning"
        >
          <div
            className="ns-callout__title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>⚠️</span>
            Content Warning
          </div>
          <div className="ns-callout__content">
            <p style={{ margin: '0 0 0.5rem' }}>{contentWarningReason}</p>
            <button className="ns-btn ns-btn--sm" onClick={() => setShowContent(true)}>
              Show Content
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="ns-content"
        dangerouslySetInnerHTML={{ __html: md.render(event.content) }}
        role="article"
        aria-label="Post content"
      />
    );
  };

  return (
    <article
      className={rootClasses}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard navigable cards for accessibility
      tabIndex={0}
      aria-label={`Post by ${event.pubkey.slice(0, 8)}`}
    >
      <header className="ns-event-card__header">
        <div className="ns-event-card__meta">
          <ProfileLink
            pubkey={event.pubkey}
            label={`${event.pubkey.slice(0, 8)}...`}
            title={event.pubkey}
            className="ns-profile-link"
          />
          <span className="ns-separator" aria-hidden="true">
            •
          </span>
          <time className="ns-timestamp" dateTime={new Date(event.created_at * 1000).toISOString()}>
            {new Date(event.created_at * 1000).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            })}
          </time>
        </div>

        {variant !== 'compact' && <div className="ns-badge">Kind {event.kind}</div>}
      </header>

      <div className="ns-event-card__body">
        {isPaywalled ? (
          <PaywalledContent
            itemId={paywallItemId}
            amountSats={paywallAmount}
            apiBase={apiBase ?? 'http://localhost:3001'}
            host={import.meta.env.VITE_NOSTRSTACK_HOST ?? 'localhost'}
            unlockedContent={renderContent()}
            lockedContent={
              <div className="ns-callout">
                <div className="ns-callout__title">Premium Content</div>
                <div className="ns-callout__content">
                  This content requires a payment of {paywallAmount} sats.
                </div>
              </div>
            }
          />
        ) : (
          <>
            {renderContent()}
            <LinkPreviews content={event.content} />
          </>
        )}
      </div>

      <div className="ns-event-card__actions" role="group" aria-label="Post actions">
        <EmojiReactionButton event={event} />
        <ZapButton
          event={event}
          authorLightningAddress={authorLightningAddress}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
          onZapSuccess={() => setIsZapped(true)}
          className={isZapped ? 'zapped' : ''}
        />
        <button
          className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
          onClick={() => setIsReplying(true)}
          aria-label="Reply to this post"
        >
          <span className="icon">💬</span>
          <span className="label">Reply</span>
        </button>
        {onOpenThread && (
          <button
            className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
            onClick={() => onOpenThread(event.id)}
            aria-label="View thread"
          >
            <span className="icon">🧵</span>
            <span className="label">Thread</span>
          </button>
        )}
        {pubkey && (
          <button
            className={`ns-btn ns-btn--ghost ns-btn--sm ns-action-btn ${isReposted ? 'active' : ''}`}
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
          className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
          onClick={() => setShowJson(!showJson)}
          style={{ marginLeft: 'auto' }}
          aria-label={showJson ? 'Hide source' : 'View source'}
        >
          <span className="icon">{showJson ? '👁️‍🗨️' : '👁️'}</span>
        </button>
      </div>

      <TopZaps eventId={event.id} />

      {showJson && (
        <div className="ns-event-card__json">
          <JsonView value={event} title={`Event ID: ${event.id.slice(0, 8)}...`} />
        </div>
      )}

      <ReplyModal isOpen={isReplying} onClose={() => setIsReplying(false)} parentEvent={event} />
    </article>
  );
});
