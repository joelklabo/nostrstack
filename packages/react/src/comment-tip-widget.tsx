'use client';

import { mountCommentTipWidget } from '@nostrstack/widgets';
import { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';
import { parseLnAddress } from './utils';

type CommentTipLayout = 'full' | 'compact';

export type CommentTipWidgetProps = {
  itemId?: string;
  threadId?: string;
  lnAddress?: string;
  relays?: string[];
  tipLabel?: string;
  presetAmountsSats?: number[];
  defaultAmountSats?: number;
  allowCustomAmount?: boolean;
  showFeed?: boolean;
  metadata?: Record<string, unknown>;
  baseUrl?: string;
  host?: string;
  layout?: CommentTipLayout;
  tipSize?: 'full' | 'compact';
  commentsHeader?: string;
  commentsPlaceholder?: string;
  commentsMaxItems?: number;
  commentsMaxAgeDays?: number;
  commentsLazyConnect?: boolean;
  commentsValidateEvents?: boolean;
  className?: string;
  onInvoice?: (info: {
    pr: string;
    providerRef: string | null;
    amountSats: number;
  }) => void | Promise<void>;
  onPaid?: (info: {
    pr: string;
    providerRef: string | null;
    amountSats: number;
    itemId: string;
    metadata?: unknown;
  }) => void;
};

/**
 * CommentTipWidget wraps the embed Support Grid (tips + comments) in React.
 */
export function CommentTipWidget({
  itemId,
  threadId,
  lnAddress,
  relays,
  tipLabel,
  presetAmountsSats,
  defaultAmountSats,
  allowCustomAmount,
  showFeed,
  metadata,
  baseUrl,
  host,
  layout = 'full',
  tipSize,
  commentsHeader,
  commentsPlaceholder,
  commentsMaxItems,
  commentsMaxAgeDays,
  commentsLazyConnect,
  commentsValidateEvents,
  className,
  onInvoice,
  onPaid
}: CommentTipWidgetProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => {
    const parsed = parseLnAddress(lnAddress ?? cfg.lnAddress);
    return {
      username: parsed?.username ?? 'anonymous',
      host: host ?? parsed?.domain ?? cfg.host,
      baseUrl: baseUrl ?? cfg.baseUrl
    };
  }, [lnAddress, baseUrl, host, cfg.lnAddress, cfg.baseUrl, cfg.host]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';
    let cancelled = false;
    let cleanup: { destroy?: () => void } | null = null;

    void mountCommentTipWidget(node, {
      username: resolved.username,
      itemId,
      threadId,
      presetAmountsSats,
      defaultAmountSats,
      allowCustomAmount,
      showFeed,
      text: tipLabel,
      baseURL: resolved.baseUrl,
      host: resolved.host,
      metadata,
      layout,
      size: tipSize,
      relays: relays ?? cfg.relays,
      headerText: commentsHeader,
      placeholder: commentsPlaceholder,
      maxItems: commentsMaxItems,
      maxAgeDays: commentsMaxAgeDays,
      lazyConnect: commentsLazyConnect,
      validateEvents: commentsValidateEvents,
      onInvoice,
      onPaid
    })
      .then((handle) => {
        if (cancelled) {
          handle?.destroy?.();
          return;
        }
        cleanup = handle as { destroy?: () => void };
      })
      .catch(() => {
        // ignore mount errors
      });

    return () => {
      cancelled = true;
      if (cleanup?.destroy) {
        try {
          cleanup.destroy();
        } catch {
          // ignore
        }
      }
      node.innerHTML = '';
    };
  }, [
    resolved.username,
    resolved.host,
    resolved.baseUrl,
    itemId,
    threadId,
    presetAmountsSats,
    defaultAmountSats,
    allowCustomAmount,
    showFeed,
    tipLabel,
    metadata,
    layout,
    tipSize,
    relays,
    commentsHeader,
    commentsPlaceholder,
    commentsMaxItems,
    commentsMaxAgeDays,
    commentsLazyConnect,
    commentsValidateEvents,
    onInvoice,
    onPaid,
    cfg.relays
  ]);

  return <div ref={ref} className={className} data-ns-comment-tip-widget />;
}
