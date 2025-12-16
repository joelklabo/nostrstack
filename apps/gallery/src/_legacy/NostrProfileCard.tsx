import type { Event as NostrEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import React, { useMemo } from 'react';

import { CopyButton } from './CopyButton';
import { Nip07Status } from './Nip07Status';
import { NpubBar } from './NpubBar';
import { RelayCard } from './RelayCard';
import type { RelayStats } from './types/relay';
import { Badge } from './ui/Badge';
import { JsonView } from './ui/JsonView';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  signerReady: boolean;
  relays: string[];
  relayStats?: RelayStats;
  profileStatus?: 'idle' | 'loading' | 'ok' | 'error';
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
  metaEvent?: NostrEvent | null;
  metaRelay?: string | null;
  nip05Verified?: boolean | null;
};

export function NostrProfileCard({ pubkey, seckey, signerReady, relays, profileStatus, profile, fullProfile, metaEvent, metaRelay, nip05Verified, relayStats }: Props) {
  const name = profile?.name || (fullProfile?.display_name as string) || 'Nostr user';
  const about = profile?.about || (fullProfile?.about as string) || '—';
  const avatar = profile?.picture || (fullProfile?.picture as string) || `https://robohash.org/${(pubkey ?? 'nostr').slice(0, 8)}?set=set3&size=120x120`;
  const npub = pubkey ? safe(() => nip19.npubEncode(pubkey)) : null;
  const nip05 = (fullProfile?.nip05 as string) || undefined;
  const lud16 = (fullProfile?.lud16 as string) || undefined;
  const nip05Tone =
    nip05Verified === true
      ? 'var(--nostrstack-color-success)'
      : nip05Verified === false
        ? 'var(--nostrstack-color-warning)'
        : 'var(--nostrstack-color-text-subtle)';
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
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: signerReady
                ? 'radial-gradient(circle, color-mix(in oklab, var(--nostrstack-color-success) 25%, transparent), transparent 70%)'
                : 'none',
              filter: 'blur(6px)',
              opacity: signerReady ? 1 : 0
            }}
          />
          <img
            src={avatar}
            alt={name}
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid var(--nostrstack-color-border)',
              boxShadow: signerReady
                ? '0 10px 28px color-mix(in oklab, var(--nostrstack-color-success) 25%, transparent)'
                : 'var(--nostrstack-shadow-md)'
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: signerReady ? 'var(--nostrstack-color-success)' : 'var(--nostrstack-color-danger)',
              animation: signerReady ? 'nostrstack-pulse-soft 1.8s infinite' : 'none',
              ...(signerReady
                ? ({ '--nostrstack-pulse-color': 'var(--nostrstack-color-success)' } as Record<string, string>)
                : {})
            } as React.CSSProperties}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--nostrstack-color-text)' }}>{name}</div>
            {npub && (
              <Badge tone="accent">npub</Badge>
            )}
          </div>
          <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.92rem', maxWidth: '100%', wordBreak: 'break-word' }}>
            {about}
          </div>
          <NpubBar pubkey={pubkey ?? undefined} seckey={seckey ?? undefined} />
        </div>
      </div>

      <Nip07Status npub={npub} hasSigner={signerReady} />

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {nip05 ? (
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--nostrstack-radius-pill)', border: '1px solid var(--nostrstack-color-border)', background: 'var(--nostrstack-color-surface-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: nip05Tone }} />
            <span style={{ fontSize: '0.9rem' }}>{nip05}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--nostrstack-color-text-muted)' }}>{nip05Label}</span>
            <CopyButton text={nip05} label="Copy" />
          </span>
        ) : null}
        {lud16 ? (
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--nostrstack-radius-pill)', border: '1px solid var(--nostrstack-color-border)', background: 'var(--nostrstack-color-surface-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ⚡ {lud16}
            <CopyButton text={lud16} label="Copy" />
          </span>
        ) : null}
        {fullProfile?.website ? (
          <a href={fullProfile.website} target="_blank" rel="noreferrer" style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--nostrstack-radius-pill)', border: '1px solid var(--nostrstack-color-border)', background: 'var(--nostrstack-color-surface)', textDecoration: 'none', color: 'var(--nostrstack-color-text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            🌐 {fullProfile.website}
          </a>
        ) : null}
      </div>

      <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.65rem 0.75rem', background: 'var(--nostrstack-color-surface-subtle)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 'var(--nostrstack-radius-pill)',
                background: signerReady ? 'var(--nostrstack-color-success)' : 'var(--nostrstack-color-danger)',
                animation: signerReady ? 'nostrstack-pulse-soft 1.8s infinite' : 'none',
                ...(signerReady
                  ? ({ '--nostrstack-pulse-color': 'var(--nostrstack-color-success)' } as Record<string, string>)
                  : {})
              } as React.CSSProperties}
            />
            <strong>{signerReady ? 'Signer live' : 'No signer detected'}</strong>
          </div>
          <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>{relays.length} relays</span>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {relayActivity.map((r) => (
            <div key={r.url} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '0.4rem 0.55rem', borderRadius: 'var(--nostrstack-radius-md)', background: 'var(--nostrstack-color-surface)', border: '1px solid var(--nostrstack-color-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: 'var(--nostrstack-color-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hostLabel(r.url)}</span>
                <span style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.85rem' }}>
                  recv {r.recv} • {r.ago != null ? `${r.ago}s ago` : 'no activity yet'}
                </span>
              </div>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 'var(--nostrstack-radius-pill)',
                  background:
                    r.ago != null && r.ago < 10
                      ? 'var(--nostrstack-color-success)'
                      : 'var(--nostrstack-color-text-subtle)',
                  animation: r.ago != null && r.ago < 10 ? 'nostrstack-pulse-soft 1.8s infinite' : 'none',
                  ...(r.ago != null && r.ago < 10
                    ? ({ '--nostrstack-pulse-color': 'var(--nostrstack-color-success)' } as Record<string, string>)
                    : {})
                } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      </div>

      <ProfileDetails fullProfile={fullProfile} status={profileStatus} metaEvent={metaEvent} metaRelay={metaRelay} nip05Verified={nip05Verified} />
      <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {relays.map((r) => {
          const stat = relayStats?.[r];
          return (
            <RelayCard
              key={r}
              url={r}
              meta={{
                name: stat?.name,
                software: stat?.software,
                version: stat?.version,
                description: stat?.description,
                icon: stat?.icon,
                supportedNips: stat?.supportedNips,
                paymentRequired: stat?.paymentRequired,
                authRequired: stat?.authRequired,
                contact: stat?.contact,
                pubkey: stat?.pubkey,
                paymentsUrl: stat?.paymentsUrl,
                language: stat?.language,
                tags: stat?.tags,
                limitation: stat?.limitation
              }}
              recv={stat?.recv ?? 0}
              recvPerMin={stat?.recvPerMin}
              recvHistory={stat?.recvHistory}
              send={stat?.send ?? 0}
              sendPerMin={stat?.sendPerMin}
              sendHistory={stat?.sendHistory}
              errorCount={stat?.errorCount ?? 0}
              lastError={stat?.lastError}
              sendStatus={stat?.sendStatus}
              last={stat?.last}
              lastSentAt={stat?.lastSentAt}
              lastEvent={stat?.lastEvent}
              latencyMs={stat?.latencyMs}
              online={stat?.online}
              lastProbeAt={stat?.lastProbeAt}
            />
          );
        })}
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

function ProfileDetails({
  fullProfile,
  status,
  metaEvent,
  metaRelay,
  nip05Verified
}: {
  fullProfile?: Props['fullProfile'];
  status?: Props['profileStatus'];
  metaEvent?: NostrEvent | null;
  metaRelay?: string | null;
  nip05Verified?: boolean | null;
}) {
  if (status === 'loading') {
    return (
      <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.55rem 0.7rem', background: 'var(--nostrstack-color-surface)', color: 'var(--nostrstack-color-text-muted)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--nostrstack-color-text)' }}>Profile details</div>
        <div>Loading profile…</div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.55rem 0.7rem', background: 'var(--nostrstack-color-surface)', color: 'var(--nostrstack-color-danger)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--nostrstack-color-text)' }}>Profile details</div>
        <div>Profile fetch failed.</div>
      </div>
    );
  }
  if (!fullProfile) {
    return (
      <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.55rem 0.7rem', background: 'var(--nostrstack-color-surface)', color: 'var(--nostrstack-color-text-muted)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--nostrstack-color-text)' }}>Profile details</div>
        <div>Connect a signer to load profile metadata.</div>
      </div>
    );
  }
  const rowsRaw: Array<[string, unknown]> = [
    ['Display name', fullProfile.display_name],
    ['Name', fullProfile.name],
    ['NIP-05', fullProfile.nip05],
    ['Lightning', fullProfile.lud16],
    ['LNURL (lud06)', fullProfile.lud06],
    ['Website', fullProfile.website],
    ['Picture', fullProfile.picture],
    ['Banner', fullProfile.banner],
    ['About', fullProfile.about],
    ['Updated', metaEvent?.created_at ? new Date(metaEvent.created_at * 1000).toLocaleString() : undefined],
    ['Event id', metaEvent?.id],
    ['Relay', metaRelay]
  ];
  const rows = rowsRaw.filter(([, v]) => Boolean(v));
  if (!rows.length) {
    return (
      <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.55rem 0.7rem', background: 'var(--nostrstack-color-surface)', color: 'var(--nostrstack-color-text-muted)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--nostrstack-color-text)' }}>Profile details</div>
        <div>No profile metadata available.</div>
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid var(--nostrstack-color-border)', borderRadius: 'var(--nostrstack-radius-lg)', padding: '0.55rem 0.7rem', background: 'var(--nostrstack-color-surface)' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--nostrstack-color-text)' }}>Profile details</div>
      <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '0.35rem', columnGap: '0.5rem', margin: 0 }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt style={dt}>{label}</dt>
            <dd style={dd}>
              {label === 'Website' && typeof value === 'string' ? (
                <a href={value} target="_blank" rel="noreferrer">{value}</a>
              ) : label === 'NIP-05' && typeof value === 'string' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{value}</span>
                  <span
                    style={{
                      padding: '0.1rem 0.5rem',
                      borderRadius: 'var(--nostrstack-radius-pill)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      border: '1px solid var(--nostrstack-color-border)',
                      background:
                        nip05Verified === true
                          ? 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))'
                          : nip05Verified === false
                            ? 'color-mix(in oklab, var(--nostrstack-color-warning) 14%, var(--nostrstack-color-surface))'
                            : 'var(--nostrstack-color-surface-subtle)',
                      color:
                        nip05Verified === true
                          ? 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))'
                          : nip05Verified === false
                            ? 'color-mix(in oklab, var(--nostrstack-color-warning) 70%, var(--nostrstack-color-text))'
                            : 'var(--nostrstack-color-text-muted)'
                    }}
                  >
                    {nip05Verified === true ? 'verified' : nip05Verified === false ? 'unverified' : 'unknown'}
                  </span>
                  <CopyButton text={value} label="Copy" size="sm" />
                </span>
              ) : (label === 'Picture' || label === 'Banner') && typeof value === 'string' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <a href={value} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                  <CopyButton text={value} label="Copy" size="sm" />
                </span>
              ) : label === 'Event id' && typeof value === 'string' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: 'var(--nostrstack-font-mono)' }}>
                    {value.slice(0, 10)}…{value.slice(-6)}
                  </code>
                  <CopyButton text={value} label="Copy" size="sm" />
                </span>
              ) : label === 'Relay' && typeof value === 'string' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: 'var(--nostrstack-font-mono)' }}>{hostLabel(value)}</code>
                  <CopyButton text={value} label="Copy" size="sm" />
                </span>
              ) : (
                value as React.ReactNode
              )}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div style={{ marginTop: '0.75rem' }}>
        <JsonView title="Raw metadata" value={fullProfile} maxHeight={220} />
      </div>
    </div>
  );
}

const dt: React.CSSProperties = { margin: 0, color: 'var(--nostrstack-color-text-muted)', fontWeight: 600, fontSize: '0.9rem' };
const dd: React.CSSProperties = { margin: 0, fontSize: '0.95rem', color: 'var(--nostrstack-color-text)', wordBreak: 'break-word' };

function hostLabel(url: string) {
  try {
    return new URL(url.replace(/^ws/, 'http')).host;
  } catch {
    return url;
  }
}
