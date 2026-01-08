"use client";

import { mountTipWidget } from '@nostrstack/widgets';
import React, { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';
import { parseLnAddress } from './utils';

export type TipWidgetProps = {
  itemId?: string;
  lnAddress?: string;
  label?: string;
  presetAmountsSats?: number[];
  defaultAmountSats?: number;
  allowCustomAmount?: boolean;
  showFeed?: boolean;
  metadata?: Record<string, unknown>;
  baseUrl?: string;
  host?: string;
  className?: string;
  onInvoice?: (info: { pr: string; providerRef: string | null; amountSats: number }) => void | Promise<void>;
  onPaid?: (info: { pr: string; providerRef: string | null; amountSats: number; itemId: string; metadata?: unknown }) => void;
};

export function TipWidget({
  itemId,
  lnAddress,
  label,
  presetAmountsSats,
  defaultAmountSats,
  allowCustomAmount,
  showFeed,
  metadata,
  baseUrl,
  host,
  className,
  onInvoice,
  onPaid,
}: TipWidgetProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => {
    const parsed = parseLnAddress(lnAddress ?? cfg.lnAddress);
    return {
      username: parsed?.username ?? 'anonymous',
      host: host ?? parsed?.domain ?? cfg.host,
      baseUrl: baseUrl ?? cfg.baseUrl,
    };
  }, [lnAddress, baseUrl, host, cfg.lnAddress, cfg.baseUrl, cfg.host]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const handle = mountTipWidget(node, {
      username: resolved.username,
      itemId,
      text: label,
      presetAmountsSats,
      defaultAmountSats,
      allowCustomAmount,
      showFeed,
      baseURL: resolved.baseUrl,
      host: resolved.host,
      metadata,
      onInvoice,
      onPaid,
    });

    return () => {
      try {
        handle?.destroy?.();
      } catch {
        // ignore
      }
      node.innerHTML = '';
    };
  }, [
    resolved.username,
    resolved.host,
    resolved.baseUrl,
    itemId,
    label,
    presetAmountsSats,
    defaultAmountSats,
    allowCustomAmount,
    showFeed,
    metadata,
    onInvoice,
    onPaid,
  ]);

  return <div ref={ref} className={className} data-nostrstack-tip-widget />;
}

