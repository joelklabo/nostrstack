import { nip19 } from 'nostr-tools';

import { CopyButton } from './CopyButton';
import { KeyChip } from './KeyChip';
import { Nip07Status } from './Nip07Status';
import { RelayCard } from './RelayCard';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  signerReady: boolean;
  relays: string[];
  profile?: { name?: string; about?: string; picture?: string };
  fullProfile?: Record<string, unknown>;
  nip05Verified?: boolean | null;
};

export function NostrProfileCard({ pubkey, seckey, signerReady, relays, profile, fullProfile, nip05Verified }: Props) {
  const name = profile?.name || (fullProfile?.display_name as string) || 'Nostr user';
  const about = profile?.about || (fullProfile?.about as string) || '—';
  const avatar = profile?.picture || (fullProfile?.picture as string) || `https://robohash.org/${(pubkey ?? 'nostr').slice(0, 8)}?set=set3&size=120x120`;
  const npub = pubkey ? safe(() => nip19.npubEncode(pubkey)) : null;
  const nip05 = (fullProfile?.nip05 as string) || undefined;
  const lud16 = (fullProfile?.lud16 as string) || undefined;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.9rem', alignItems: 'start' }}>
      <img src={avatar} alt={name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{name}</div>
          <div style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '100%', wordBreak: 'break-word' }}>{about}</div>
        </div>
        <KeyChip pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} compact />
        <Nip07Status npub={npub} hasSigner={signerReady} />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {nip05 ? (
            <span style={{ padding: '0.3rem 0.6rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: nip05Verified ? '#22c55e' : '#f59e0b' }} />
              <span style={{ fontSize: '0.9rem' }}>{nip05}</span>
              <CopyButton text={nip05} label="Copy" />
            </span>
          ) : null}
          {lud16 ? (
            <span style={{ padding: '0.3rem 0.6rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ⚡ {lud16}
              <CopyButton text={lud16} label="Copy" />
            </span>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {relays.map((r) => (
            <RelayCard key={r} url={r} />
          ))}
        </div>
        {fullProfile ? (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.55rem 0.7rem', background: '#fff' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Profile details</div>
            <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '0.35rem', columnGap: '0.5rem', margin: 0 }}>
              {fullProfile.display_name ? (<><dt style={dt}>Display</dt><dd style={dd}>{fullProfile.display_name as string}</dd></>) : null}
              {fullProfile.website ? (<><dt style={dt}>Website</dt><dd style={dd}><a href={fullProfile.website as string} target="_blank" rel="noreferrer">{fullProfile.website as string}</a></dd></>) : null}
              {fullProfile.banner ? (<><dt style={dt}>Banner</dt><dd style={dd}>{fullProfile.banner as string}</dd></>) : null}
              {fullProfile.about ? (<><dt style={dt}>About</dt><dd style={dd}>{fullProfile.about as string}</dd></>) : null}
            </dl>
          </div>
        ) : null}
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

const dt: React.CSSProperties = { margin: 0, color: '#475569', fontWeight: 600, fontSize: '0.9rem' };
const dd: React.CSSProperties = { margin: 0, fontSize: '0.95rem', color: '#0f172a' };
