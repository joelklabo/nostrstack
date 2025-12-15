import { useMemo, useState } from 'react';

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
  const [iconOk, setIconOk] = useState(true);
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
  const moreNips = Math.max(0, (meta?.supportedNips?.length ?? 0) - nipPills.length);
  const securityPills = [meta?.paymentRequired ? 'payment' : null, meta?.authRequired ? 'auth' : null].filter(
    Boolean
  ) as string[];
  const description = meta?.description?.slice(0, 110) ?? '';
  const softwareLine = meta?.software
    ? `${meta.software}${meta?.version ? ` ${meta.version}` : ''}`
    : meta?.version
      ? `v${meta.version}`
      : null;
  const subline = [meta?.name ?? null, softwareLine].filter(Boolean).join(' • ') || '—';
  const showIcon = Boolean(meta?.icon && iconOk);

  return (
    <div
      className="nostrstack-card relay-card"
      data-online={statusState}
      data-hot={recvHot || sendHot ? '1' : '0'}
      style={{ '--relay-accent': tone.dot } as React.CSSProperties}
    >
      <div className="relay-card__top">
        <div className="relay-card__identity">
          <div className="relay-card__avatar" aria-hidden>
            {showIcon ? (
              <img
                src={meta!.icon}
                alt=""
                loading="lazy"
                className="relay-card__avatarImg"
                onError={() => setIconOk(false)}
              />
            ) : (
              <span className="relay-card__avatarFallback">{meta?.icon ? '🛰️' : '📡'}</span>
            )}
            <span
              className="relay-card__dot"
              style={{
                background: tone.dot,
                animation: recvHot || sendHot ? 'nostrstack-pulse-soft 1.8s infinite' : undefined,
                ...(recvHot || sendHot ? ({ '--nostrstack-pulse-color': tone.dot } as Record<string, string>) : {})
              } as React.CSSProperties}
            />
          </div>
          <div className="relay-card__titles">
            <div className="relay-card__host" title={url}>
              {host}
            </div>
            <div className="relay-card__sub" title={subline}>
              {subline}
            </div>
          </div>
        </div>

        <div className="relay-card__right">
          <Badge
            tone={statusState === 'offline' ? 'danger' : statusState === 'online' ? 'success' : 'muted'}
            title={statusTitle}
            style={{ textTransform: 'capitalize' }}
          >
            {statusLabel}
          </Badge>
          <div className="relay-card__actions">
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

      {description ? <div className="relay-card__desc">{description}</div> : null}

      <div className="relay-card__chips">
        {securityPills.map((p) => (
          <Badge key={p} tone="danger">
            {p}
          </Badge>
        ))}
        {nipPills.map((n) => (
          <Badge key={n} tone="accent">
            NIP-{n}
          </Badge>
        ))}
        {moreNips ? <Badge tone="muted">+{moreNips}</Badge> : null}
        {!securityPills.length && !nipPills.length ? <Badge tone="muted">base</Badge> : null}
      </div>

      <div className="relay-card__bottom">
        <div className="relay-card__stats">
          <span>
            recv <strong>{recv}</strong>
          </span>
          {recvPerMin != null ? <span>· {recvPerMin}/min</span> : null}
          {tone.badge ? <span style={{ color: tone.dot }}>· {tone.badge}</span> : null}
        </div>
        <div className="relay-card__when" title={tooltip}>
          {lastLabel}
          {sendLabel ? ` · ${sendLabel}` : ''}
        </div>
        <div className="relay-card__spark" aria-hidden>
          {activityBars.map((h, idx) => (
            <span key={idx} style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
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
