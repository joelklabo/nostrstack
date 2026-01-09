'use client';

import { mountBlockchainStats } from '@nostrstack/widgets';
import { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';

export type BlockchainStatsProps = {
  baseUrl?: string;
  host?: string;
  title?: string;
  className?: string;
};

export function BlockchainStats({ baseUrl, host, title, className }: BlockchainStatsProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(
    () => ({
      baseUrl: baseUrl ?? cfg.baseUrl,
      host: host ?? cfg.host
    }),
    [baseUrl, host, cfg.baseUrl, cfg.host]
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const handle = mountBlockchainStats(node, {
      baseURL: resolved.baseUrl,
      host: resolved.host,
      title
    });

    return () => {
      try {
        handle?.destroy?.();
      } catch {
        // ignore
      }
      node.innerHTML = '';
    };
  }, [resolved.baseUrl, resolved.host, title]);

  return <div ref={ref} className={className} data-ns-blockchain />;
}
