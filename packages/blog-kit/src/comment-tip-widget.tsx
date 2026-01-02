"use client";

import { mountCommentTipWidget } from '@nostrstack/embed';
import React, { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';
import { parseLnAddress } from './utils';

export type CommentTipWidgetProps = {
  /** Item id shared between tips + comments. */
  itemId?: string;
  /** Thread id for comments; falls back to itemId when omitted. */
  threadId?: string;
  /** Lightning address (lud16) for tips. */
  lnAddress?: string;
  /** Default relay list for comments. */
  relays?: string[];
  /** Layout mode; compact stacks sidebar above comments. */
  layout?: 'full' | 'compact';
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
};

/**
 * CommentTipWidget combines the tip widget and comments into a single grid.
 * Useful for blog post footers or dedicated support sections.
 */
export function CommentTipWidget({
  itemId,
  threadId,
  lnAddress,
  relays,
  layout = 'full',
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
}: CommentTipWidgetProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => {
    const resolvedLn = lnAddress ?? cfg.lnAddress;
    const parsedLn = parseLnAddress(resolvedLn ?? null);
    return {
      username: parsedLn?.username ?? 'anonymous',
      host: host ?? parsedLn?.domain ?? cfg.host,
      baseUrl: baseUrl ?? cfg.baseUrl,
      relays: relays ?? cfg.relays,
    };
  }, [lnAddress, cfg.lnAddress, host, cfg.host, baseUrl, cfg.baseUrl, relays, cfg.relays]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const promise = mountCommentTipWidget(node, {
      username: resolved.username,
      itemId,
      threadId,
      text: tipLabel,
      presetAmountsSats: tipPresetAmountsSats,
      defaultAmountSats: tipDefaultAmountSats,
      allowCustomAmount: tipAllowCustomAmount,
      showFeed: tipShowFeed,
      metadata: tipMetadata,
      baseURL: resolved.baseUrl,
      host: resolved.host,
      relays: resolved.relays,
      headerText: commentsHeader,
      placeholder: commentsPlaceholder,
      maxItems: commentsMaxItems,
      maxAgeDays: commentsMaxAgeDays,
      lazyConnect: commentsLazyConnect,
      validateEvents: commentsValidateEvents,
      layout,
    });

    return () => {
      promise.then((handle: { destroy?: () => void } | null | undefined) => {
        try {
          handle?.destroy?.();
        } catch {
          // ignore
        }
      });
      node.innerHTML = '';
    };
  }, [
    resolved,
    itemId,
    threadId,
    tipLabel,
    tipPresetAmountsSats,
    tipDefaultAmountSats,
    tipAllowCustomAmount,
    tipShowFeed,
    tipMetadata,
    commentsHeader,
    commentsPlaceholder,
    commentsMaxItems,
    commentsMaxAgeDays,
    commentsLazyConnect,
    commentsValidateEvents,
    layout,
  ]);

  return <div ref={ref} className={className} data-nostrstack-comment-tip-widget />;
}
