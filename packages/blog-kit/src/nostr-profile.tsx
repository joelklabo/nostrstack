"use client";

import { mountNostrProfile } from '@nostrstack/embed';
import React, { useEffect, useMemo, useRef } from 'react';

import { useNostrstackConfig } from './context';

export type NostrProfileProps = {
  identifier?: string;
  relays?: string[];
  baseUrl?: string;
  host?: string;
  title?: string;
  className?: string;
};

export function NostrProfileWidget({ identifier, relays, baseUrl, host, title, className }: NostrProfileProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  const resolved = useMemo(
    () => ({
      baseUrl: baseUrl ?? cfg.baseUrl,
      host: host ?? cfg.host,
      relays: relays ?? cfg.relays
    }),
    [baseUrl, host, relays, cfg.baseUrl, cfg.host, cfg.relays]
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const handle = mountNostrProfile(node, {
      identifier,
      baseURL: resolved.baseUrl,
      host: resolved.host,
      relays: resolved.relays,
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
  }, [identifier, resolved.baseUrl, resolved.host, resolved.relays, title]);

  return <div ref={ref} className={className} data-nostrstack-profile />;
}
