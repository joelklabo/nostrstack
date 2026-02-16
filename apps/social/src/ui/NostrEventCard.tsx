import { PaywalledContent, ReplyModal, useAuth, ZapButton } from '@nostrstack/react';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import type { Event } from 'nostr-tools';
import { memo, useCallback, useState } from 'react';

import { useRepost } from '../hooks/useRepost';
import { buildNoteLink } from '../utils/navigation';
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

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  if (!src) return '';
  const alt = token.content ? token.content : '';
  return `<img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}" loading="lazy" decoding="async" class="ns-content__image" width="16" height="9" />`;
};

/** Human-readable labels for Nostr event kinds */
const EVENT_KIND_LABELS: Record<number, string> = {
  0: 'Profile',
  1: 'Note',
  3: 'Contacts',
  4: 'DM',
  5: 'Delete',
  6: 'Repost',
  7: 'Reaction',
  8: 'Badge Award',
  9: 'Chat',
  10: 'Group Chat',
  40: 'Channel',
  41: 'Channel Metadata',
  42: 'Channel Message',
  1984: 'Report',
  9735: 'Zap',
  10000: 'Mute List',
  10001: 'Pin List',
  10002: 'Relay List',
  30000: 'Profile Badges',
  30008: 'Badge Definition',
  30009: 'Badge Award',
  30023: 'Article',
  30078: 'App Data'
};

function getKindLabel(kind: number): string {
  return EVENT_KIND_LABELS[kind] ?? `Kind ${kind}`;
}

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [zapAmount, setZapAmount] = useState(21);
  const { repost, loading: repostLoading } = useRepost();
  const { pubkey } = useAuth();

  const handleRepost = useCallback(async () => {
    if (repostLoading || isReposted) return;
    const success = await repost(event);
    if (success) setIsReposted(true);
  }, [repost, event, repostLoading, isReposted]);

  const handleCopyLink = useCallback(async () => {
    try {
      const link = buildNoteLink(event.id);
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy link', e);
    }
  }, [event.id]);

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
  const openThreadLabel = `Open post ${event.id.slice(0, 8)} by ${event.pubkey.slice(0, 8)}`;

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
            <button
              type="button"
              className="ns-btn ns-btn--sm"
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
        className="ns-content"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(md.render(event.content)) }}
        role="article"
        aria-label="Post content"
      />
    );
  };

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Don't navigate if clicking on action buttons, links, or interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest('.ns-event-card__actions') ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('.ns-event-card__json')
      ) {
        return;
      }
      onOpenThread?.(event.id);
    },
    [event.id, onOpenThread]
  );

  return (
    <article className={rootClasses} aria-label={`Post by ${event.pubkey.slice(0, 8)}`}>
      <div
        className="ns-event-card__body-wrapper"
        role={onOpenThread ? 'button' : undefined}
        tabIndex={onOpenThread ? 0 : undefined}
        aria-label={onOpenThread ? openThreadLabel : undefined}
        onClick={onOpenThread ? handleCardClick : undefined}
        onKeyDown={
          onOpenThread
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenThread(event.id);
                }
              }
            : undefined
        }
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
            <time
              className="ns-timestamp"
              dateTime={new Date(event.created_at * 1000).toISOString()}
            >
              {new Date(event.created_at * 1000).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </time>
          </div>

          {variant !== 'compact' && (
            <div className="ns-badge" title={`Nostr event kind ${event.kind}`}>
              {getKindLabel(event.kind)}
            </div>
          )}
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
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="ns-event-card__actions"
        role="group"
        aria-label="Post actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <EmojiReactionButton event={event} />
        <div className="zap-button-group">
          <div className="zap-amount-selector" role="radiogroup" aria-label="Zap amount">
            {[21, 50, 100, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                className={`zap-amount-btn ${zapAmount === amount ? 'active' : ''}`}
                onClick={() => setZapAmount(amount)}
                aria-pressed={zapAmount === amount}
                title={`Zap ${amount} sats`}
              >
                {amount}
              </button>
            ))}
          </div>
          <ZapButton
            event={event}
            authorLightningAddress={authorLightningAddress}
            apiBase={apiBase}
            enableRegtestPay={enableRegtestPay}
            amountSats={zapAmount}
            onZapSuccess={() => setIsZapped(true)}
            className={isZapped ? 'zapped' : ''}
          />
        </div>
        <button
          className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
          type="button"
          onClick={() => setIsReplying(true)}
          aria-label="Reply to this post"
        >
          <span className="icon" aria-hidden="true">
            💬
          </span>
          <span className="label">Reply</span>
        </button>
        {onOpenThread && (
          <button
            className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
            type="button"
            onClick={() => onOpenThread(event.id)}
            aria-label="View thread"
          >
            <span className="icon" aria-hidden="true">
              🧵
            </span>
            <span className="label">Thread</span>
          </button>
        )}
        {pubkey && (
          <button
            className={`ns-btn ns-btn--ghost ns-btn--sm ns-action-btn ${isReposted ? 'active' : ''}`}
            type="button"
            onClick={handleRepost}
            disabled={repostLoading || isReposted}
            aria-label={isReposted ? 'Reposted' : 'Repost this post'}
          >
            <span className="icon" aria-hidden="true">
              ↻
            </span>
            <span className="label">
              {repostLoading ? '...' : isReposted ? 'Reposted' : 'Repost'}
            </span>
          </button>
        )}
        <button
          className={`ns-btn ns-btn--ghost ns-btn--sm ns-action-btn ${linkCopied ? 'active' : ''}`}
          type="button"
          onClick={handleCopyLink}
          aria-label={linkCopied ? 'Link copied' : 'Copy link to post'}
          title={linkCopied ? 'Link copied!' : 'Copy link'}
        >
          <span className="icon" aria-hidden="true">
            {linkCopied ? '✓' : '🔗'}
          </span>
          <span className="label">{linkCopied ? 'Copied' : 'Link'}</span>
        </button>

        <button
          className="ns-btn ns-btn--ghost ns-btn--sm ns-action-btn"
          type="button"
          onClick={() => setShowJson(!showJson)}
          style={{ marginLeft: 'auto' }}
          aria-label={showJson ? 'Hide event source JSON' : 'View event source JSON'}
          aria-expanded={showJson}
          title={showJson ? 'Hide source' : 'View source'}
        >
          <span className="icon" aria-hidden="true">
            {showJson ? '👁️‍🗨️' : '👁️'}
          </span>
          <span className="sr-only">{showJson ? 'Hide source' : 'View source'}</span>
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
