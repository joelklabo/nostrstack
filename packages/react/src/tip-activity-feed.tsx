"use client";

import { mountTipFeed } from '@nostrstack/widgets';
import React, { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';
import { parseLnAddress } from './utils';

export type TipActivityFeedProps = {
  itemId?: string;
  lnAddress?: string;
  maxItems?: number;
  baseUrl?: string;
  host?: string;
  className?: string;
};

export function TipActivityFeed({ itemId, lnAddress, maxItems, baseUrl, host, className }: TipActivityFeedProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => {
    const parsed = parseLnAddress(lnAddress ?? cfg.lnAddress);
    return {
      host: host ?? parsed?.domain ?? cfg.host,
      baseUrl: baseUrl ?? cfg.baseUrl,
    };
  }, [lnAddress, baseUrl, host, cfg.lnAddress, cfg.baseUrl, cfg.host]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const handle = mountTipFeed(node, {
      itemId,
      maxItems,
      baseURL: resolved.baseUrl,
      host: resolved.host,
    });

    return () => {
      try {
        handle?.destroy?.();
      } catch {
        // ignore
      }
      node.innerHTML = '';
    };
  }, [itemId, maxItems, resolved.baseUrl, resolved.host]);

  return <div ref={ref} className={className} data-nostrstack-tip-feed />;
}

