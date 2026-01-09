'use client';

import { mountTipButton } from '@nostrstack/widgets';
import { useEffect, useRef } from 'react';

import { useNostrstackConfig } from './context';
import { parseLnAddress } from './utils';

export type TipButtonProps = {
  lnAddress?: string;
  amountSats?: number;
  label?: string;
  baseUrl?: string;
  host?: string;
  className?: string;
};

export function TipButton({
  lnAddress,
  amountSats,
  label,
  baseUrl,
  host,
  className
}: TipButtonProps) {
  const cfg = useNostrstackConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = '';

    const parsed = parseLnAddress(lnAddress ?? cfg.lnAddress);
    const username = parsed?.username ?? 'anonymous';
    const resolvedHost = host ?? parsed?.domain ?? cfg.host;
    const resolvedBase = baseUrl ?? cfg.baseUrl;

    mountTipButton(node, {
      username,
      amountSats,
      text: label,
      baseURL: resolvedBase,
      host: resolvedHost
    });

    return () => {
      node.innerHTML = '';
    };
  }, [lnAddress, amountSats, label, baseUrl, host, cfg.lnAddress, cfg.baseUrl, cfg.host]);

  return <div ref={ref} className={className} data-ns-tip />;
}
