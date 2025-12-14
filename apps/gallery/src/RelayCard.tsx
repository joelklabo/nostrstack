import { useMemo } from 'react';

import { CopyButton } from './CopyButton';
import { Badge } from './ui/Badge';

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
  recvPerMin?: number;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  last?: number;
  lastSentAt?: number;
  latencyMs?: number;
  online?: boolean;
  lastProbeAt?: number;
};

export function RelayCard({
  url,
  meta,
  recv = 0,
  recvPerMin,
  sendStatus,
  last,
  lastSentAt,
  latencyMs,
  online,
  lastProbeAt
}: Props) {
  const host = useMemo(() => {
    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch {
      return url;
    }
  }, [url]);

  const now = Date.now();
  const recvHot = last && now - last < 4000;
  const sendHot = lastSentAt && now - lastSentAt < 4000;
  const tone =
    sendStatus === 'sending'
      ? { dot: 'var(--nostrstack-color-info)', badge: '• sending' }
      : sendStatus === 'ok'
        ? { dot: 'var(--nostrstack-color-success)', badge: sendHot ? '✓ sent' : '' }
        : sendStatus === 'error'
          ? { dot: 'var(--nostrstack-color-danger)', badge: '! error' }
          : { dot: 'var(--nostrstack-color-text-subtle)', badge: '' };

  const lastLabel = last ? timeAgo(last) : 'no recent activity';
  const sendLabel = lastSentAt ? `${timeAgo(lastSentAt)} (send)` : null;
  const activityBars = buildSpark(recv);
  const tooltip = last ? new Date(last).toLocaleTimeString() : '—';
  const statusState = online === false ? 'offline' : online === true ? 'online' : 'unknown';
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
      className="nostrstack-card relay-card"
      style={{
        padding: '0.75rem 0.85rem',
        boxShadow: 'var(--nostrstack-shadow-md)'
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ position: 'relative', width: 36, height: 36 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--nostrstack-radius-md)',
              background: 'var(--nostrstack-color-surface-strong)',
              border: '1px solid var(--nostrstack-color-border)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden'
            }}
          >
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
              borderRadius: 'var(--nostrstack-radius-pill)',
              background: tone.dot,
              animation: recvHot || sendHot ? 'nostrstack-pulse-soft 1.8s infinite' : undefined,
              ...(recvHot || sendHot ? ({ '--nostrstack-pulse-color': tone.dot } as Record<string, string>) : {})
            } as React.CSSProperties}
          />
        </div>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <strong
              style={{
                fontSize: '0.95rem',
                color: 'var(--nostrstack-color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {host}
            </strong>
            {securityPills.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: '0.72rem',
                  background:
                    'color-mix(in oklab, var(--nostrstack-color-danger) 14%, var(--nostrstack-color-surface))',
                  color:
                    'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--nostrstack-radius-pill)',
                  border:
                    '1px solid color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                {p}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: '0.82rem',
              color: 'var(--nostrstack-color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {(meta?.name || '—')}{meta?.software ? ` • ${meta.software}${meta?.version ? ` ${meta.version}` : ''}` : meta?.version ? ` • v${meta.version}` : ''}
          </span>
          {description && (
            <span
              style={{
                fontSize: '0.82rem',
                color: 'var(--nostrstack-color-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {description}
            </span>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nipPills.map((n) => (
              <Pill key={n} label={`NIP-${n}`} tone="accent" />
            ))}
            {securityPills.length === 0 && nipPills.length === 0 ? <Pill label="base" tone="muted" /> : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 130 }}>
          <Badge
            tone={statusState === 'offline' ? 'danger' : statusState === 'online' ? 'success' : 'muted'}
            title={statusTitle}
            style={{ textTransform: 'capitalize' }}
          >
            {statusLabel}
          </Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge tone="muted">recv {recv}</Badge>
            {recvPerMin != null && (
              <Badge tone="muted">{recvPerMin}/min</Badge>
            )}
            {tone.badge && <span style={{ fontSize: '0.78rem', color: tone.dot }}>{tone.badge}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {activityBars.map((h, idx) => (
              <span key={idx} title={tooltip} style={{ width: 5, height: h, borderRadius: 2, background: tone.dot, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--nostrstack-color-text-muted)', whiteSpace: 'nowrap' }}>{lastLabel}</span>
          {sendLabel && <span style={{ fontSize: '0.75rem', color: 'var(--nostrstack-color-text-muted)', whiteSpace: 'nowrap' }}>{sendLabel}</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <CopyButton text={url} label="Copy" />
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                window.open(url.replace(/^ws/, 'http'), '_blank', 'noreferrer');
              }}
              className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'muted' }) {
  const styles =
    tone === 'accent'
      ? {
          bg: 'color-mix(in oklab, var(--nostrstack-color-accent) 14%, var(--nostrstack-color-surface))',
          fg: 'color-mix(in oklab, var(--nostrstack-color-accent) 70%, var(--nostrstack-color-text))',
          border: 'color-mix(in oklab, var(--nostrstack-color-accent) 35%, var(--nostrstack-color-border))'
        }
      : {
          bg: 'var(--nostrstack-color-surface-strong)',
          fg: 'var(--nostrstack-color-text-muted)',
          border: 'var(--nostrstack-color-border)'
        };

  return (
    <span
      style={{
        fontSize: '0.72rem',
        color: styles.fg,
        background: styles.bg,
        padding: '0.15rem 0.45rem',
        borderRadius: 'var(--nostrstack-radius-pill)',
        border: `1px solid ${styles.border}`,
        letterSpacing: '0.03em'
      }}
    >
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
