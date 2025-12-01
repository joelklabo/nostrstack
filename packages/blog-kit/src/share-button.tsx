"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { relayInit, type Relay } from 'nostr-tools';
import { useNostrstackConfig } from './context';
import { parseRelays } from './utils';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

async function publishToRelays(relays: string[], event: any) {
  const connections: Relay[] = [];
  try {
    for (const url of relays) {
      const relay = relayInit(url);
      await relay.connect();
      connections.push(relay);
      await new Promise<void>((resolve, reject) => {
        const pub = relay.publish(event);
        const timer = setTimeout(() => reject(new Error('publish timeout')), 5000);
        pub.on('ok', () => {
          clearTimeout(timer);
          resolve();
        });
        pub.on('failed', (reason: string) => {
          clearTimeout(timer);
          reject(new Error(reason || 'publish failed'));
        });
      });
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
  const [state, setState] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const relayList = useMemo(() => relays ?? cfg.relays ?? DEFAULT_RELAYS, [relays, cfg.relays]);
  const note = useMemo(
    () => `${title}\n${url}${lnAddress ? `\n⚡ ${lnAddress}` : ''}`,
    [title, url, lnAddress],
  );

  const handleShare = useCallback(async () => {
    setError(null);
    setState('sharing');
    const nostr = (globalThis as any).nostr;

    if (nostr && relayList.length) {
      try {
        const pubkey = await nostr.getPublicKey();
        const now = Math.floor(Date.now() / 1000);
        const event = {
          kind: 1,
          created_at: now,
          tags: [
            ['r', url],
            ...(tag ? [['t', tag]] : []),
          ],
          content: note,
          pubkey,
        };
        const signed = await nostr.signEvent(event);
        await publishToRelays(relayList, signed);
        setState('copied');
        return;
      } catch (err: any) {
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
    } catch (err: any) {
      setError(err?.message ?? 'Share failed');
      setState('error');
    }
  }, [note, title, url, tag, relayList]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleShare}
        disabled={state === 'sharing'}
        style={{
          background: 'var(--ns-surface)',
          color: 'var(--ns-text)',
          border: '1px solid var(--ns-border)',
          borderRadius: 999,
          padding: '0.5rem 0.9rem',
          fontWeight: 600,
          cursor: state === 'sharing' ? 'wait' : 'pointer',
        }}
      >
        {state === 'sharing' ? 'Sharing…' : state === 'copied' ? 'Shared' : 'Share to Nostr'}
      </button>
      {error && <p style={{ color: '#f87171', marginTop: 6, fontSize: 13 }}>{error}</p>}
    </div>
  );
}
