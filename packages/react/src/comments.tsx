'use client';

import { mountCommentWidget } from '@nostrstack/widgets';
import { useEffect, useMemo, useRef } from 'react';

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

export function Comments({
  threadId,
  relays,
  headerText,
  placeholder,
  maxItems,
  maxAgeDays,
  lazyConnect,
  validateEvents,
  className
}: CommentsProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  // Memoize merged relays to avoid reference changes causing re-renders
  const mergedRelays = useMemo(
    () => relays ?? cfg.relays ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialize arrays for stable comparison
    [relays?.join(','), cfg.relays?.join(',')]
  );

  const thread = threadId ?? 'nostrstack-thread';

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const promise = mountCommentWidget(node, {
      threadId: thread,
      relays: mergedRelays,
      headerText,
      placeholder,
      maxItems,
      maxAgeDays,
      lazyConnect,
      validateEvents
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
  }, [
    thread,
    mergedRelays,
    headerText,
    placeholder,
    maxItems,
    maxAgeDays,
    lazyConnect,
    validateEvents
  ]);

  return <div ref={ref} className={className} data-nostrstack-comments />;
}
