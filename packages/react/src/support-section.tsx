'use client';

import type React from 'react';
import { useMemo } from 'react';

import { Comments } from './comments';
import { useNostrstackConfig } from './context';
import { ShareButton } from './share-button';
import { TipWidget } from './tip-widget';
import { parseLnAddress } from './utils';

type SupportLayout = 'compact' | 'full';

export type SupportSectionProps = {
  /** Item id shared between tips + comments. */
  itemId?: string;
  /** Thread id for comments; falls back to itemId when omitted. */
  threadId?: string;
  /** Lightning address (lud16) for tips + share note. */
  lnAddress?: string;
  /** Default relay list for comments + share. */
  relays?: string[];
  /** Share URL (defaults to current location in browser). */
  shareUrl?: string;
  /** Share title (defaults to document title in browser). */
  shareTitle?: string;
  /** Optional hashtag tag for nostr share. */
  shareTag?: string;
  /** Layout mode; compact stacks sidebar above comments. */
  layout?: SupportLayout;
  /** Section heading. */
  title?: string;
  /** Tip widget label text. */
  tipLabel?: string;
  /** Tip presets in sats. */
  tipPresetAmountsSats?: number[];
  /** Default tip amount in sats. */
  tipDefaultAmountSats?: number;
  /** Allow custom tip amount entry. */
  tipAllowCustomAmount?: boolean;
  /** Show tip activity feed inside TipWidget. */
  tipShowFeed?: boolean;
  /** Tip metadata sent with payments. */
  tipMetadata?: Record<string, unknown>;
  /** Override API base URL. */
  baseUrl?: string;
  /** Override tenant host. */
  host?: string;
  /** Comments header text. */
  commentsHeader?: string;
  /** Comments composer placeholder text. */
  commentsPlaceholder?: string;
  /** Max comments to load per batch. */
  commentsMaxItems?: number;
  /** Max comment age in days. */
  commentsMaxAgeDays?: number;
  /** Lazy connect to relays for comments. */
  commentsLazyConnect?: boolean;
  /** Validate Nostr comment events when possible. */
  commentsValidateEvents?: boolean;
  /** Root class name override. */
  className?: string;
  /** Class name for tip widget container. */
  tipClassName?: string;
  /** Class name for comments container. */
  commentsClassName?: string;
  /** Class name for share button container. */
  shareClassName?: string;
  /** Accessible label for the section. */
  ariaLabel?: string;
};

/**
 * SupportSection groups tips, sharing, and comments for a single post/page.
 * Handles missing lnAddress (tips) or share URL/title by showing a muted callout.
 */
export function SupportSection({
  itemId,
  threadId,
  lnAddress,
  relays,
  shareUrl,
  shareTitle,
  shareTag,
  layout = 'full',
  title = 'Support',
  tipLabel,
  tipPresetAmountsSats,
  tipDefaultAmountSats,
  tipAllowCustomAmount,
  tipShowFeed,
  tipMetadata,
  baseUrl,
  host,
  commentsHeader,
  commentsPlaceholder,
  commentsMaxItems,
  commentsMaxAgeDays,
  commentsLazyConnect,
  commentsValidateEvents,
  className,
  tipClassName,
  commentsClassName,
  shareClassName,
  ariaLabel
}: SupportSectionProps) {
  const cfg = useNostrstackConfig();
  const resolvedLn = lnAddress ?? cfg.lnAddress;
  const parsedLn = useMemo(() => parseLnAddress(resolvedLn ?? null), [resolvedLn]);
  const canTip = Boolean(parsedLn);
  const effectiveThread = threadId ?? itemId;
  const effectiveRelays = relays ?? cfg.relays;

  const shareDefaults = useMemo(() => {
    const fallbackUrl = typeof window !== 'undefined' ? window.location?.href ?? '' : '';
    const fallbackTitle = typeof document !== 'undefined' ? document.title ?? 'Share' : 'Share';
    return {
      url: shareUrl ?? fallbackUrl,
      title: shareTitle ?? fallbackTitle
    };
  }, [shareUrl, shareTitle]);
  const canShare = Boolean(shareDefaults.url && shareDefaults.title);
  const resolvedTipFeed = tipShowFeed ?? layout === 'full';

  const rootClassName = ['nostrstack-support-section', className].filter(Boolean).join(' ');
  const gridClassName = ['nostrstack-support-grid', 'nostrstack-comment-tip__grid'].join(' ');
  const sidebarClassName = ['nostrstack-support-sidebar'].filter(Boolean).join(' ');
  const regionLabel = ariaLabel ?? title ?? 'Support';

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 'var(--nostrstack-space-4)',
    alignItems: 'start',
    gridTemplateColumns: layout === 'compact' ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 340px)'
  };

  const sidebarStyle: React.CSSProperties = {
    display: 'grid',
    gap: 'var(--nostrstack-space-3)'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--nostrstack-space-2)',
    marginBottom: 'var(--nostrstack-space-3)'
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    color: 'var(--nostrstack-color-text)'
  };

  const tipNode = canTip ? (
    <TipWidget
      itemId={itemId}
      lnAddress={resolvedLn ?? undefined}
      label={tipLabel}
      presetAmountsSats={tipPresetAmountsSats}
      defaultAmountSats={tipDefaultAmountSats}
      allowCustomAmount={tipAllowCustomAmount}
      showFeed={resolvedTipFeed}
      metadata={tipMetadata}
      baseUrl={baseUrl ?? cfg.baseUrl}
      host={host ?? cfg.host}
      className={tipClassName}
    />
  ) : (
    <div className={`nostrstack-callout${tipClassName ? ` ${tipClassName}` : ''}`} role="status">
      <div className="nostrstack-callout__title">Tips unavailable</div>
      <div className="nostrstack-callout__content">Provide a lightning address to enable tips.</div>
    </div>
  );

  const shareWrapStyle: React.CSSProperties = {
    padding: 'var(--nostrstack-space-3)',
    borderRadius: 'var(--nostrstack-radius-lg)',
    border: '1px solid var(--nostrstack-color-border)',
    background: 'var(--nostrstack-color-surface)',
    boxShadow: 'var(--nostrstack-shadow-md)'
  };

  const shareNode = (
    <div
      className={['nostrstack-support-share', shareClassName].filter(Boolean).join(' ')}
      style={shareWrapStyle}
    >
      {canShare ? (
        <ShareButton
          url={shareDefaults.url}
          title={shareDefaults.title}
          lnAddress={resolvedLn ?? undefined}
          relays={effectiveRelays}
          tag={shareTag}
          className={shareClassName}
        />
      ) : (
        <div className="nostrstack-callout" role="status">
          <div className="nostrstack-callout__title">Share unavailable</div>
          <div className="nostrstack-callout__content">
            Provide a share URL + title to enable sharing.
          </div>
        </div>
      )}
    </div>
  );

  const commentsNode = (
    <Comments
      threadId={effectiveThread}
      relays={effectiveRelays}
      headerText={commentsHeader}
      placeholder={commentsPlaceholder}
      maxItems={commentsMaxItems}
      maxAgeDays={commentsMaxAgeDays}
      lazyConnect={commentsLazyConnect}
      validateEvents={commentsValidateEvents}
      className={commentsClassName}
    />
  );

  const sidebar = (
    <div className={sidebarClassName} style={sidebarStyle} aria-label="Support actions">
      {tipNode}
      {shareNode}
    </div>
  );

  return (
    <section className={rootClassName} aria-label={regionLabel}>
      {title && (
        <div className="nostrstack-support-header" style={headerStyle}>
          <h2 style={sectionTitleStyle}>{title}</h2>
        </div>
      )}
      <div className={gridClassName} style={gridStyle}>
        {layout === 'compact' ? sidebar : commentsNode}
        {layout === 'compact' ? commentsNode : sidebar}
      </div>
    </section>
  );
}
