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
  fullProfile?: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    banner?: string;
    nip05?: string;
    lud16?: string;
    lud06?: string;
    website?: string;
  };
  nip05Verified?: boolean | null;
};

export function NostrProfileCard({ pubkey, seckey, signerReady, relays, profile, fullProfile, nip05Verified }: Props) {
  const name = profile?.name || (fullProfile?.display_name as string) || 'Nostr user';
  const about = profile?.about || (fullProfile?.about as string) || '—';
  const avatar = profile?.picture || (fullProfile?.picture as string) || `https://robohash.org/${(pubkey ?? 'nostr').slice(0, 8)}?set=set3&size=120x120`;
  const npub = pubkey ? safe(() => nip19.npubEncode(pubkey)) : null;
  const nip05 = (fullProfile?.nip05 as string) || undefined;
  const lud16 = (fullProfile?.lud16 as string) || undefined;
  const nip05Tone = nip05Verified === true ? '#22c55e' : nip05Verified === false ? '#f97316' : '#94a3b8';
  const nip05Label = nip05Verified === true ? 'Verified NIP-05' : nip05Verified === false ? 'Not verified' : 'NIP-05';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.9rem', alignItems: 'start' }}>
      <img src={avatar} alt={name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{name}</div>
            <div style={{ color: '#475569', fontSize: '0.9rem', maxWidth: '100%', wordBreak: 'break-word' }}>{about}</div>
          </div>
          <KeyChip pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} compact style={{ maxWidth: '100%', overflow: 'hidden' }} mode="npub-hex-toggle" />
        <Nip07Status npub={npub} hasSigner={signerReady} />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {nip05 ? (
            <span style={{ padding: '0.3rem 0.6rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: nip05Tone }} />
              <span style={{ fontSize: '0.9rem' }}>{nip05}</span>
              <span style={{ fontSize: '0.8rem', color: '#475569' }}>{nip05Label}</span>
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
        <ProfileDetails fullProfile={fullProfile} />
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

function ProfileDetails({ fullProfile }: { fullProfile?: Props['fullProfile'] }) {
  if (!fullProfile) {
    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.55rem 0.7rem', background: '#fff', color: '#475569' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>Profile details</div>
        <div>Loading profile…</div>
      </div>
    );
  }
  const rows = [
    ['Display name', fullProfile.display_name],
    ['Name', fullProfile.name],
    ['NIP-05', fullProfile.nip05],
    ['Lightning', fullProfile.lud16],
    ['LNURL (lud06)', fullProfile.lud06],
    ['Website', fullProfile.website],
    ['Banner', fullProfile.banner],
    ['About', fullProfile.about]
  ].filter(([, v]) => Boolean(v));
  if (!rows.length) {
    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.55rem 0.7rem', background: '#fff', color: '#475569' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>Profile details</div>
        <div>No profile metadata available.</div>
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.55rem 0.7rem', background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Profile details</div>
      <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '0.35rem', columnGap: '0.5rem', margin: 0 }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt style={dt}>{label}</dt>
            <dd style={dd}>
              {label === 'Website' && typeof value === 'string' ? (
                <a href={value} target="_blank" rel="noreferrer">{value}</a>
              ) : (
                value as React.ReactNode
              )}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

const dt: React.CSSProperties = { margin: 0, color: '#475569', fontWeight: 600, fontSize: '0.9rem' };
const dd: React.CSSProperties = { margin: 0, fontSize: '0.95rem', color: '#0f172a', wordBreak: 'break-word' };
