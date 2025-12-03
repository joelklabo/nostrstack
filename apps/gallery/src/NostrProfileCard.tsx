import { nip19 } from 'nostr-tools';
import { useMemo } from 'react';

import { CopyButton } from './CopyButton';
import { KeyChip } from './KeyChip';
import { Nip07Status } from './Nip07Status';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  signerReady: boolean;
  relays: string[];
  relayStats?: Record<string, { recv: number; last?: number; lastSentAt?: number; name?: string; software?: string }>;
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

export function NostrProfileCard({ pubkey, seckey, signerReady, relays, profile, fullProfile, nip05Verified, relayStats }: Props) {
  const name = profile?.name || (fullProfile?.display_name as string) || 'Nostr user';
  const about = profile?.about || (fullProfile?.about as string) || '—';
  const avatar = profile?.picture || (fullProfile?.picture as string) || `https://robohash.org/${(pubkey ?? 'nostr').slice(0, 8)}?set=set3&size=120x120`;
  const npub = pubkey ? safe(() => nip19.npubEncode(pubkey)) : null;
  const nip05 = (fullProfile?.nip05 as string) || undefined;
  const lud16 = (fullProfile?.lud16 as string) || undefined;
  const nip05Tone = nip05Verified === true ? '#22c55e' : nip05Verified === false ? '#f97316' : '#94a3b8';
  const nip05Label = nip05Verified === true ? 'Verified NIP-05' : nip05Verified === false ? 'Not verified' : 'NIP-05';
  const relayActivity = useMemo(() => {
    const now = Date.now();
    return relays.map((url) => {
      const stat = relayStats?.[url];
      const lastTs = stat?.last ?? stat?.lastSentAt;
      const ago = lastTs ? Math.max(0, Math.floor((now - lastTs) / 1000)) : null;
      return { url, recv: stat?.recv ?? 0, ago };
    });
  }, [relayStats, relays]);

  return (
    <div style={{ display: 'grid', gap: '0.75rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.85rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 76, height: 76 }}>
          <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: signerReady ? 'radial-gradient(circle, rgba(34,197,94,0.25), rgba(34,197,94,0) 70%)' : 'none', filter: 'blur(6px)', opacity: signerReady ? 1 : 0 }} />
          <img src={avatar} alt={name} style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0', boxShadow: signerReady ? '0 10px 28px rgba(34,197,94,0.25)' : '0 6px 18px rgba(15,23,42,0.12)' }} />
          <span style={{ position: 'absolute', bottom: 4, right: 4, width: 12, height: 12, borderRadius: '50%', background: signerReady ? '#22c55e' : '#ef4444', boxShadow: signerReady ? '0 0 0 0 rgba(34,197,94,0.35)' : 'none', animation: signerReady ? 'pulse 1.8s infinite' : 'none' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: '1.08rem', color: '#0f172a' }}>{name}</div>
            {npub && <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontSize: '0.78rem', fontWeight: 700 }}>npub</span>}
          </div>
          <div style={{ color: '#475569', fontSize: '0.92rem', maxWidth: '100%', wordBreak: 'break-word' }}>{about}</div>
          <KeyChip pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} compact style={{ maxWidth: '100%', overflow: 'hidden' }} />
        </div>
      </div>

      <Nip07Status npub={npub} hasSigner={signerReady} />

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {nip05 ? (
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: nip05Tone }} />
            <span style={{ fontSize: '0.9rem' }}>{nip05}</span>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>{nip05Label}</span>
            <CopyButton text={nip05} label="Copy" />
          </span>
        ) : null}
        {lud16 ? (
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ⚡ {lud16}
            <CopyButton text={lud16} label="Copy" />
          </span>
        ) : null}
        {fullProfile?.website ? (
          <a href={fullProfile.website} target="_blank" rel="noreferrer" style={{ padding: '0.35rem 0.65rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', textDecoration: 'none', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🌐 {fullProfile.website}
          </a>
        ) : null}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.65rem 0.75rem', background: '#f8fafc', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: signerReady ? '#22c55e' : '#ef4444', boxShadow: signerReady ? '0 0 0 0 rgba(34,197,94,0.35)' : 'none', animation: signerReady ? 'pulse 1.8s infinite' : 'none' }} />
            <strong>{signerReady ? 'Signer live' : 'No signer detected'}</strong>
          </div>
          <span style={{ fontSize: '0.9rem', color: '#475569' }}>{relays.length} relays</span>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {relayActivity.map((r) => (
            <div key={r.url} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '0.4rem 0.55rem', borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hostLabel(r.url)}</span>
                <span style={{ color: '#475569', fontSize: '0.85rem' }}>
                  recv {r.recv} • {r.ago != null ? `${r.ago}s ago` : 'no activity yet'}
                </span>
              </div>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: r.ago != null && r.ago < 10 ? '#22c55e' : '#94a3b8', boxShadow: r.ago != null && r.ago < 10 ? '0 0 0 0 rgba(34,197,94,0.35)' : 'none', animation: r.ago != null && r.ago < 10 ? 'pulse 1.8s infinite' : 'none' }} />
            </div>
          ))}
        </div>
      </div>

      <ProfileDetails fullProfile={fullProfile} />
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

function hostLabel(url: string) {
  try {
    return new URL(url.replace(/^ws/, 'http')).host;
  } catch {
    return url;
  }
}
