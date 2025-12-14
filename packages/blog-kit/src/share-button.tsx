"use client";

import { ensureNostrstackRoot } from '@nostrstack/embed';
import { Relay } from 'nostr-tools/relay';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNostrstackConfig } from './context';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

type UnsignedEvent = {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
};

type SignedEvent = UnsignedEvent & {
  id: string;
  sig: string;
};

async function publishToRelays(relays: string[], event: SignedEvent) {
  const connections: Relay[] = [];
  try {
    for (const url of relays) {
      const relay = await Relay.connect(url);
      connections.push(relay);
      await relay.publish(event);
    }
  } finally {
    connections.forEach((r) => r.close());
  }
}

async function copyText(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch (error) {
    console.warn('clipboard copy failed', error);
  }
}

export type ShareButtonProps = {
  url: string;
  title: string;
  lnAddress?: string;
  relays?: string[];
  tag?: string;
  className?: string;
};

export function ShareButton({ url, title, lnAddress, relays, tag, className }: ShareButtonProps) {
  const cfg = useNostrstackConfig();
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    ensureNostrstackRoot(rootRef.current);
  }, []);

  const relayList = useMemo(() => relays ?? cfg.relays ?? DEFAULT_RELAYS, [relays, cfg.relays]);
  const note = useMemo(
    () => `${title}\n${url}${lnAddress ? `\n⚡ ${lnAddress}` : ''}`,
    [title, url, lnAddress]
  );

  const handleShare = useCallback(async () => {
    setError(null);
    setState('sharing');
    const nostr = (
      globalThis as unknown as {
        nostr?: {
          getPublicKey: () => Promise<string>;
          signEvent: (ev: UnsignedEvent) => Promise<SignedEvent>;
        };
      }
    ).nostr;

    if (nostr && relayList.length) {
      try {
        const pubkey = await nostr.getPublicKey();
        const now = Math.floor(Date.now() / 1000);
        const event: UnsignedEvent = {
          kind: 1,
          created_at: now,
          tags: [['r', url], ...(tag ? [['t', tag]] : [])],
          content: note,
          pubkey
        };
        const signed = await nostr.signEvent(event);
        await publishToRelays(relayList, signed);
        setState('copied');
        return;
      } catch (err) {
        console.warn('nostr share failed, falling back', err);
      }
    }

    try {
      if (navigator?.share) {
        await navigator.share({ title, text: note, url });
        setState('copied');
        return;
      }
      await copyText(note);
      setState('copied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed');
      setState('error');
    }
  }, [note, title, url, tag, relayList]);

  return (
    <div ref={rootRef} className={className}>
      <button
        type="button"
        onClick={handleShare}
        disabled={state === 'sharing'}
        aria-busy={state === 'sharing'}
        className="nostrstack-btn nostrstack-btn--primary"
      >
        {state === 'sharing' ? 'Sharing…' : state === 'copied' ? 'Shared' : 'Share to Nostr'}
      </button>
      {error && (
        <p
          role="alert"
          style={{ color: 'var(--nostrstack-color-danger)', marginTop: 6, fontSize: 13 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
