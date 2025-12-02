import { nip19 } from 'nostr-tools';

import { KeyToggle } from './KeyToggle';
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

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <img src={avatar} alt={name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{name}</div>
          <div style={{ color: '#475569', fontSize: '0.9rem' }}>{about}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{npub ?? 'npub unavailable'}</div>
        </div>
        <Nip07Status npub={npub} hasSigner={signerReady} />
        <div style={{ fontSize: '0.9rem', color: '#475569' }}>Relays: {relays.join(', ') || 'mock'}</div>
        <KeyToggle pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} />
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

