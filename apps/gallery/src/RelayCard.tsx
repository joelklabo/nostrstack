import { useMemo } from 'react';

import { CopyButton } from './CopyButton';

type RelayMeta = {
  name?: string;
  software?: string;
  version?: string;
  description?: string;
  supportedNips?: number[];
  icon?: string;
  paymentRequired?: boolean;
  authRequired?: boolean;
};

type Props = {
  url: string;
  meta?: RelayMeta;
  recv?: number;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  last?: number;
  lastSentAt?: number;
  latencyMs?: number;
  online?: boolean;
  lastProbeAt?: number;
  theme?: 'light' | 'dark';
};

export function RelayCard({ url, meta, recv = 0, sendStatus, last, lastSentAt, latencyMs, online, lastProbeAt, theme = 'light' }: Props) {
  const host = useMemo(() => {
    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch {
      return url;
    }
  }, [url]);

  const palette =
    theme === 'dark'
      ? { card: '#0b1220', text: '#e2e8f0', sub: '#cbd5e1', border: '#1f2937', chip: '#0f172a', accent: '#38bdf8' }
      : { card: '#fff', text: '#0f172a', sub: '#475569', border: '#e2e8f0', chip: '#f8fafc', accent: '#0ea5e9' };

  const now = Date.now();
  const recvHot = last && now - last < 4000;
  const sendHot = lastSentAt && now - lastSentAt < 4000;
  const tone =
    sendStatus === 'sending'
      ? { dot: '#0ea5e9', shadow: 'rgba(14,165,233,0.35)', badge: '• sending' }
      : sendStatus === 'ok'
        ? { dot: '#22c55e', shadow: 'rgba(34,197,94,0.35)', badge: sendHot ? '✓ sent' : '' }
        : sendStatus === 'error'
          ? { dot: '#ef4444', shadow: 'rgba(239,68,68,0.35)', badge: '! error' }
          : { dot: '#94a3b8', shadow: 'rgba(148,163,184,0.35)', badge: '' };

  const lastLabel = last ? timeAgo(last) : 'no recent activity';
  const sendLabel = lastSentAt ? `${timeAgo(lastSentAt)} (send)` : null;
  const activityBars = buildSpark(recv);
  const tooltip = last ? new Date(last).toLocaleTimeString() : '—';
  const statusState = online === false ? 'offline' : online === true ? 'online' : 'unknown';
  const statusColor = statusState === 'offline' ? '#ef4444' : statusState === 'online' ? '#15803d' : palette.sub;
  const statusBg = statusState === 'offline' ? '#fef2f2' : statusState === 'online' ? '#ecfdf3' : palette.chip;
  const statusLabel = latencyMs != null && statusState !== 'unknown' ? `${statusState} • ${latencyMs}ms` : statusState;
  const statusTitle = lastProbeAt ? `last probe ${new Date(lastProbeAt).toLocaleTimeString()}` : undefined;
  const nipPills = (meta?.supportedNips ?? []).slice(0, 4);
  const securityPills = [
    meta?.paymentRequired ? 'payment' : null,
    meta?.authRequired ? 'auth' : null
  ].filter(Boolean) as string[];
  const description = meta?.description?.slice(0, 120) ?? '';

  return (
    <div
      className="relay-card"
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: '0.75rem 0.85rem',
        background: palette.card,
        boxShadow: '0 10px 28px rgba(15,23,42,0.08)'
      }}
    >
      <style>{`
        @keyframes relay-pulse { 0% { box-shadow: 0 0 0 0 ${tone.shadow}; } 70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ position: 'relative', width: 36, height: 36 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: palette.chip, border: `1px solid ${palette.border}`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.9rem' }}>{meta?.icon ? '🛰️' : '📡'}</span>
          </div>
          <span
            className={recvHot || sendHot ? 'pulse' : ''}
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: tone.dot,
              boxShadow: recvHot || sendHot ? `0 0 0 6px ${tone.shadow}` : undefined,
              animation: recvHot || sendHot ? 'relay-pulse 1.8s infinite' : undefined
            }}
          />
        </div>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <strong style={{ fontSize: '0.95rem', color: palette.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{host}</strong>
            {securityPills.map((p) => (
              <span key={p} style={{ fontSize: '0.72rem', background: '#fef2f2', color: '#b91c1c', padding: '0.15rem 0.45rem', borderRadius: 999, border: '1px solid #fecdd3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {p}
              </span>
            ))}
          </div>
          <span style={{ fontSize: '0.82rem', color: palette.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(meta?.name || '—')}{meta?.software ? ` • ${meta.software}${meta?.version ? ` ${meta.version}` : ''}` : meta?.version ? ` • v${meta.version}` : ''}
          </span>
          {description && <span style={{ fontSize: '0.82rem', color: palette.sub, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{description}</span>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nipPills.map((n) => (
              <Pill key={n} label={`NIP-${n}`} color={palette.accent} />
            ))}
            {securityPills.length === 0 && nipPills.length === 0 ? <Pill label="base" color={palette.sub} /> : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 130 }}>
          <span
            title={statusTitle}
            style={{
              fontSize: '0.78rem',
              color: statusColor,
              background: statusBg,
              border: `1px solid ${palette.border}`,
              padding: '0.18rem 0.55rem',
              borderRadius: 999,
              textTransform: 'capitalize'
            }}
          >
            {statusLabel}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', color: palette.text, background: palette.chip, border: `1px solid ${palette.border}`, padding: '0.2rem 0.55rem', borderRadius: 999 }}>
              recv {recv}
            </span>
            {tone.badge && <span style={{ fontSize: '0.78rem', color: tone.dot }}>{tone.badge}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {activityBars.map((h, idx) => (
              <span key={idx} title={tooltip} style={{ width: 5, height: h, borderRadius: 2, background: tone.dot, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: palette.sub, whiteSpace: 'nowrap' }}>{lastLabel}</span>
          {sendLabel && <span style={{ fontSize: '0.75rem', color: palette.sub, whiteSpace: 'nowrap' }}>{sendLabel}</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <CopyButton text={url} label="Copy" />
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                window.open(url.replace(/^ws/, 'http'), '_blank', 'noreferrer');
              }}
              style={{ border: `1px solid ${palette.border}`, background: palette.chip, color: palette.text, borderRadius: 8, padding: '0.15rem 0.55rem', cursor: 'pointer' }}
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: '0.72rem', color, background: 'rgba(14,165,233,0.08)', padding: '0.15rem 0.45rem', borderRadius: 999, border: `1px solid ${color}22`, letterSpacing: '0.03em' }}>
      {label}
    </span>
  );
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function buildSpark(recv: number) {
  const bars = 8;
  const level = Math.min(bars, Math.max(1, Math.ceil(Math.log10(recv + 1) * 3)));
  return Array.from({ length: bars }, (_, i) => (i < level ? 10 + i * 2 : 6));
}
