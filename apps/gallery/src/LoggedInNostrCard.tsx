import type { Event as NostrEvent, EventTemplate } from 'nostr-tools';
import { nip19, Relay } from 'nostr-tools';
import { useEffect, useMemo, useState } from 'react';

import { CopyButton } from './CopyButton';
import { colors, layout } from './tokens';

type SendStatus = 'idle' | 'sending' | 'ok' | 'error';

type Status = 'idle' | 'working' | 'ok' | 'error';

export function LoggedInNostrCard({ relays, onRelayStatus, pubkey: externalPubkey, signerReady }: { relays: string[]; pubkey?: string | null; signerReady?: boolean; onRelayStatus?: (relay: string, status: SendStatus, message?: string) => void }) {
  const [pubkey, setPubkey] = useState<string | null>(externalPubkey ?? null);
  const [npub, setNpub] = useState<string | null>(externalPubkey ? safe(() => nip19.npubEncode(externalPubkey)) : null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('Hello from nostrstack demo 👋');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const hasSigner = signerReady ?? (typeof window !== 'undefined' && Boolean(window.nostr?.getPublicKey));

  const relayUrl = useMemo(() => {
    const first = relays.find((r) => r.startsWith('wss://') || r.startsWith('ws://'));
    return first ?? 'wss://relay.damus.io';
  }, [relays]);

  useEffect(() => {
    if (externalPubkey) {
      setPubkey(externalPubkey);
      setNpub(safe(() => nip19.npubEncode(externalPubkey)));
      return;
    }
    const load = async () => {
      if (!hasSigner) return;
      try {
        const pk = await window.nostr!.getPublicKey();
        setPubkey(pk);
        setNpub(safe(() => nip19.npubEncode(pk)));
      } catch (err) {
        console.warn('nostr getPublicKey failed', err);
      }
    };
    load();
  }, [externalPubkey, hasSigner]);

  const sendNote = async () => {
    if (!hasSigner) {
      setLastResult('No NIP-07 signer detected');
      return;
    }
    setStatus('working');
    setLastResult(null);
    try {
      const pk = pubkey ?? (await window.nostr!.getPublicKey());
      const template: EventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: message || 'nostrstack ping'
      };
      const signed = (await window.nostr!.signEvent(template)) as NostrEvent;

      onRelayStatus?.(relayUrl, 'sending', 'publishing');
      const relay = await Relay.connect(relayUrl);
      await relay.publish(signed);
      relay.close();

      setStatus('ok');
      setLastResult(`Published note to ${relayUrl}`);
      setPubkey(pk);
      setNpub(safe(() => nip19.npubEncode(pk)));
      onRelayStatus?.(relayUrl, 'ok', 'published');
    } catch (err) {
      setStatus('error');
      setLastResult(err instanceof Error ? err.message : String(err));
      onRelayStatus?.(relayUrl, 'error', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', wordBreak: 'break-word' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: hasSigner ? '#22c55e' : '#ef4444' }} />
        <strong>{hasSigner ? 'Signer available' : 'No NIP-07 signer detected'}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ color: colors.subtle, fontSize: '0.9rem' }}>Pubkey:</span>
        <code style={{ fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '100%' }}>{npub ?? pubkey ?? '—'}</code>
        {pubkey ? <CopyButton text={pubkey} label="Copy hex" size="sm" /> : null}
        {npub ? <CopyButton text={npub} label="Copy npub" size="sm" /> : null}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>Demo message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          style={{
            borderRadius: layout.radius,
            border: `1px solid ${layout.border}`,
            padding: '0.6rem',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={sendNote} disabled={!hasSigner || status === 'working'} style={{ padding: '0.55rem 1rem' }}>
          {status === 'working' ? 'Sending…' : 'Send signed note'}
        </button>
        <span style={{ fontSize: '0.9rem', color: colors.subtle }}>Relay: {relayUrl}</span>
      </div>

      {lastResult && (
        <div
          style={{
            padding: '0.55rem 0.75rem',
            borderRadius: layout.radius,
            border: `1px solid ${status === 'ok' ? '#22c55e44' : '#ef444444'}`,
            background: status === 'ok' ? '#ecfdf3' : '#fef2f2',
            color: status === 'ok' ? '#166534' : '#b91c1c',
            fontSize: '0.9rem'
          }}
        >
          {lastResult}
        </div>
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
