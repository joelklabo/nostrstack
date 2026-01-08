'use client';

import { mountShareButton } from '@nostrstack/widgets';
import { useEffect, useRef } from 'react';

import { useNostrstackConfig } from './context';

export type ShareButtonProps = {
  url: string;
  title: string;
  lnAddress?: string;
  relays?: string[];
  tag?: string;
  className?: string;
  /** Button label text override. */
  label?: string;
};

export function ShareButton({
  url,
  title,
  lnAddress,
  relays,
  tag,
  className,
  label
}: ShareButtonProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const handle = mountShareButton(node, {
      url,
      title,
      lnAddress: lnAddress ?? cfg.lnAddress,
      relays: relays ?? cfg.relays,
      tag,
      label
    });

    return () => {
      try {
        handle?.destroy?.();
      } catch {
        // ignore
      }
      node.innerHTML = '';
    };
  }, [url, title, lnAddress, relays, tag, label, cfg.lnAddress, cfg.relays]);

  return <div ref={ref} className={className} data-nostrstack-share-button />;
}
