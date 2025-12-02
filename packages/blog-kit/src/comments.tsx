"use client";

import { mountCommentWidget } from '@nostrstack/embed';
import React, { useEffect, useRef } from 'react';

import { useNostrstackConfig } from './context';

export type CommentsProps = {
  threadId?: string;
  relays?: string[];
  headerText?: string;
  placeholder?: string;
  className?: string;
};

export function Comments({ threadId, relays, headerText, placeholder, className }: CommentsProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const mergedRelays = relays ?? cfg.relays ?? [];
    const thread = threadId ?? 'nostrstack-thread';

    mountCommentWidget(node, {
      threadId: thread,
      relays: mergedRelays,
      headerText,
      placeholder,
    });

    return () => {
      node.innerHTML = '';
    };
  }, [threadId, relays, headerText, placeholder, cfg.relays]);

  return <div ref={ref} className={className} data-nostrstack-comments />;
}
