"use client";

import { mountCommentWidget } from '@nostrstack/widgets';
import React, { useEffect, useRef } from 'react';

import { useNostrstackConfig } from './context';

export type CommentsProps = {
  threadId?: string;
  relays?: string[];
  headerText?: string;
  placeholder?: string;
  maxItems?: number;
  maxAgeDays?: number;
  lazyConnect?: boolean;
  validateEvents?: boolean;
  className?: string;
};

export function Comments({ threadId, relays, headerText, placeholder, maxItems, maxAgeDays, lazyConnect, validateEvents, className }: CommentsProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const mergedRelays = relays ?? cfg.relays ?? [];
    const thread = threadId ?? 'nostrstack-thread';

    const promise = mountCommentWidget(node, {
      threadId: thread,
      relays: mergedRelays,
      headerText,
      placeholder,
      maxItems,
      maxAgeDays,
      lazyConnect,
      validateEvents,
    });

    return () => {
      promise.then((handle) => {
        try {
          handle?.destroy?.();
        } catch {
          // ignore
        }
      });
      node.innerHTML = '';
    };
  }, [threadId, relays, headerText, placeholder, maxItems, maxAgeDays, lazyConnect, validateEvents, cfg.relays]);

  return <div ref={ref} className={className} data-nostrstack-comments />;
}
