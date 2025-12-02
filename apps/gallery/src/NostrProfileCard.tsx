import { nip19 } from 'nostr-tools';

import { CopyButton } from './CopyButton';
import { KeyChip } from './KeyChip';
import { Nip07Status } from './Nip07Status';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  signerReady: boolean;
  relays: string[];
  profile?: { name?: string; about?: string; picture?: string };
};

export function NostrProfileCard({ pubkey, seckey, signerReady, relays, profile }: Props) {
  const name = profile?.name || 'Nostr user';
  const about = profile?.about || '—';
  const avatar = profile?.picture || `https://robohash.org/${(pubkey ?? 'nostr').slice(0, 8)}?set=set3&size=120x120`;
  const npub = pubkey ? safe(() => nip19.npubEncode(pubkey)) : null;
  const relayLabel = relays.length ? relays.join(', ') : 'mock';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.9rem', alignItems: 'start' }}>
      <img src={avatar} alt={name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{name}</div>
          <div style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '100%', wordBreak: 'break-word' }}>{about}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>{npub ? truncate(npub) : 'npub unavailable'}</span>
          {npub ? <CopyButton text={npub} label="Copy npub" /> : null}
        </div>
        <Nip07Status npub={npub} hasSigner={signerReady} />
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.55rem 0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontWeight: 700, color: '#0ea5e9', fontSize: '0.95rem' }}>Keys</div>
          <KeyChip pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} />
        </div>
        <div style={{ fontSize: '0.9rem', color: '#475569' }}>Relays: {relayLabel}</div>
      </div>
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

function truncate(value: string, keep = 8) {
  if (!value) return value;
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
