import { useEffect, useMemo, useRef, useState } from 'react';

import { CopyButton } from './CopyButton';
import type { RelayLimits } from './types/relay';
import { Badge } from './ui/Badge';
import { JsonView } from './ui/JsonView';
import { useNow } from './useNow';

type RelayMeta = {
  name?: string;
  software?: string;
  version?: string;
  description?: string;
  supportedNips?: number[];
  icon?: string;
  paymentRequired?: boolean;
  authRequired?: boolean;
  contact?: string;
  pubkey?: string;
  paymentsUrl?: string;
  language?: string;
  tags?: string[];
  limitation?: RelayLimits;
};

type RelayLastEvent = {
  ts: number;
  direction: 'recv' | 'send' | 'error';
  label: string;
  sublabel?: string;
  payload?: unknown;
};

type Props = {
  url: string;
  meta?: RelayMeta;
  recv?: number;
  recvPerMin?: number;
  recvHistory?: Array<{ ts: number }>;
  send?: number;
  sendPerMin?: number;
  sendHistory?: Array<{ ts: number }>;
  errorCount?: number;
  lastError?: string;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  last?: number;
  lastSentAt?: number;
  lastEvent?: RelayLastEvent;
  latencyMs?: number;
  online?: boolean;
  lastProbeAt?: number;
};

export function RelayCard({
  url,
  meta,
  recv = 0,
  recvPerMin,
  recvHistory,
  send = 0,
  sendPerMin: _sendPerMin,
  sendHistory,
  errorCount = 0,
  lastError,
  sendStatus,
  last,
  lastSentAt,
  lastEvent,
  latencyMs,
  online,
  lastProbeAt
}: Props) {
  const now = useNow();
  const [iconOk, setIconOk] = useState(true);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [flash, setFlash] = useState<{ recv: boolean; send: boolean; error: boolean }>({
    recv: false,
    send: false,
    error: false
  });
  const prevRef = useRef<{ recv: number; send: number; errorCount: number; online: boolean | undefined }>({
    recv,
    send,
    errorCount,
    online
  });
  const host = useMemo(() => {
    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch {
      return url;
    }
  }, [url]);

  useEffect(() => {
    const prev = prevRef.current;
    const next = { recv, send, errorCount, online };
    const recvBumped = recv > prev.recv;
    const sendBumped = send > prev.send;
    const errorBumped = errorCount > prev.errorCount || online === false;
    prevRef.current = next;

    if (recvBumped) {
      setFlash((f) => ({ ...f, recv: true }));
      window.setTimeout(() => setFlash((f) => ({ ...f, recv: false })), 360);
    }
    if (sendBumped) {
      setFlash((f) => ({ ...f, send: true }));
      window.setTimeout(() => setFlash((f) => ({ ...f, send: false })), 360);
    }
    if (errorBumped && (prev.online !== online || errorCount > prev.errorCount)) {
      setFlash((f) => ({ ...f, error: true }));
      window.setTimeout(() => setFlash((f) => ({ ...f, error: false })), 520);
    }
  }, [recv, send, errorCount, online]);

  const recvHot = last != null && now - last < 2500;
  const sendHot = lastSentAt != null && now - lastSentAt < 2500;
  const statusState = online === false ? 'offline' : online === true ? 'online' : 'unknown';

  const latencyTone = latencyMs == null
    ? 'muted'
    : latencyMs <= 250
      ? 'success'
      : latencyMs <= 900
        ? 'warn'
        : 'danger';

  const statusLabel =
    latencyMs != null && statusState !== 'unknown'
      ? `${statusState} • ${latencyMs}ms`
      : statusState;
  const statusTitle = lastProbeAt ? `last probe ${timeAgo(lastProbeAt, now)} (${new Date(lastProbeAt).toLocaleTimeString()})` : undefined;

  const activityBars = useMemo(() => buildSparkFromHistory(recvHistory ?? [], now), [recvHistory, now]);
  const sendBars = useMemo(() => buildSparkFromHistory(sendHistory ?? [], now), [sendHistory, now]);

  const nipPills = (meta?.supportedNips ?? []).slice(0, 6);
  const moreNips = Math.max(0, (meta?.supportedNips?.length ?? 0) - nipPills.length);
  const securityPills = [meta?.paymentRequired ? 'paid' : null, meta?.authRequired ? 'auth' : null].filter(Boolean) as string[];
  const languagePill = meta?.language ? meta.language : null;
  const tags = (meta?.tags ?? []).slice(0, 3);
  const description = meta?.description?.trim() ? meta.description.trim() : '';
  const shortDesc = description.length > 120 ? `${description.slice(0, 120)}…` : description;

  const softwareLine = meta?.software
    ? `${shortSoftware(meta.software)}${meta?.version ? ` ${meta.version}` : ''}`
    : meta?.version
      ? `v${meta.version}`
      : null;

  const subline = [meta?.name ?? null, softwareLine, languagePill].filter(Boolean).join(' • ') || '—';
  const showIcon = Boolean(meta?.icon && iconOk);

  const limits = meta?.limitation ?? {};
  const limitParts = [
    limits.max_subscriptions != null ? `subs≤${limits.max_subscriptions}` : null,
    limits.max_filters != null ? `filters≤${limits.max_filters}` : null,
    limits.max_message_length != null ? `msg≤${limits.max_message_length}` : null,
    limits.max_past_seconds != null ? `past≤${formatSeconds(limits.max_past_seconds)}` : null
  ].filter(Boolean);

  const lastRecvLabel = last != null ? timeAgo(last, now) : '—';
  const lastSendLabel = lastSentAt != null ? timeAgo(lastSentAt, now) : '—';
  const lastEventLabel = lastEvent ? timeAgo(lastEvent.ts, now) : null;

  const sendBadge =
    sendStatus === 'sending'
      ? { tone: 'info' as const, label: 'sending' }
      : sendStatus === 'error'
        ? { tone: 'danger' as const, label: 'error' }
        : sendStatus === 'ok'
          ? { tone: 'success' as const, label: sendHot ? 'sent' : 'ok' }
          : { tone: 'muted' as const, label: 'idle' };

  return (
    <div
      className="nostrstack-card relay-card"
      data-online={statusState}
      data-hot={recvHot || sendHot ? '1' : '0'}
      data-flash-recv={flash.recv ? '1' : '0'}
      data-flash-send={flash.send ? '1' : '0'}
      data-flash-error={flash.error ? '1' : '0'}
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
              data-state={statusState}
              style={{
                animation: recvHot || sendHot ? 'nostrstack-pulse-soft 1.2s infinite' : undefined,
                ...(recvHot || sendHot
                  ? ({ '--nostrstack-pulse-color': 'var(--relay-live)' } as Record<string, string>)
                  : {})
              } as React.CSSProperties}
            />
          </div>
          <div className="relay-card__titles">
            <div className="relay-card__hostRow">
              <div className="relay-card__host" title={url}>
                {host}
              </div>
              <span className="relay-card__mini">{recvPerMin != null ? `${recvPerMin}/min` : '—/min'}</span>
            </div>
            <div className="relay-card__sub" title={subline}>
              {subline}
            </div>
          </div>
        </div>

        <div className="relay-card__right">
          <Badge tone={statusState === 'offline' ? 'danger' : statusState === 'online' ? latencyTone : 'muted'} title={statusTitle}>
            {statusLabel}
          </Badge>
          <div className="relay-card__actions">
            <CopyButton text={url} label="Copy" size="sm" />
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
            <button
              type="button"
              onClick={() => setInspectOpen(true)}
              className="nostrstack-btn nostrstack-btn--sm"
              disabled={!lastEvent}
              title={lastEvent ? 'Inspect last event' : 'No events yet'}
            >
              Inspect
            </button>
          </div>
        </div>
      </div>

      <div className="relay-card__rail">
        <div className="relay-card__metrics">
          <div className="relay-card__metric relay-card__metric--recv">
            <span className="relay-card__metricLabel">recv</span>
            <span className="relay-card__metricValue">{recv}</span>
            <span className="relay-card__metricSub">{lastRecvLabel}</span>
          </div>
          <div className="relay-card__metric relay-card__metric--send">
            <span className="relay-card__metricLabel">send</span>
            <span className="relay-card__metricValue">{send}</span>
            <span className="relay-card__metricSub">
              <span style={{ textTransform: 'capitalize' }}>{sendBadge.label}</span> · {lastSendLabel}
            </span>
          </div>
          <div className="relay-card__metric relay-card__metric--err" title={lastError ?? undefined}>
            <span className="relay-card__metricLabel">err</span>
            <span className="relay-card__metricValue">{errorCount}</span>
            <span className="relay-card__metricSub">{lastError ? truncate(lastError, 18) : '—'}</span>
          </div>
        </div>

        <div className="relay-card__spark" aria-hidden>
          {activityBars.map((h, idx) => (
            <span key={idx} className="relay-card__sparkCol">
              <span className="relay-card__sparkBar" style={{ height: h }} />
              <span className="relay-card__sparkBar relay-card__sparkBar--send" style={{ height: sendBars[idx] ?? 0 }} />
            </span>
          ))}
        </div>
      </div>

      {shortDesc ? <div className="relay-card__desc">{shortDesc}</div> : null}

      <div className="relay-card__chips">
        {securityPills.map((p) => (
          <Badge key={p} tone={p === 'paid' ? 'warn' : 'danger'}>
            {p}
          </Badge>
        ))}
        {tags.map((t) => (
          <Badge key={t} tone="muted">
            {t}
          </Badge>
        ))}
        {limitParts.length ? (
          <Badge tone="muted" title={limitParts.join(' · ')}>
            {limitParts.join(' · ')}
          </Badge>
        ) : null}
        {nipPills.map((n) => (
          <Badge key={n} tone="accent">
            NIP-{n}
          </Badge>
        ))}
        {moreNips ? <Badge tone="muted">+{moreNips}</Badge> : null}
        {!securityPills.length && !nipPills.length ? <Badge tone="muted">base</Badge> : null}
      </div>

      <button
        type="button"
        className="relay-card__event"
        onClick={() => lastEvent && setInspectOpen(true)}
        disabled={!lastEvent}
      >
        <span className="relay-card__eventDir" data-dir={lastEvent?.direction ?? 'recv'}>
          {lastEvent?.direction ?? 'recv'}
        </span>
        <span className="relay-card__eventText" title={lastEvent?.label ?? 'No events yet'}>
          {lastEvent ? lastEvent.label : 'Waiting for events…'}
        </span>
        <span className="relay-card__eventWhen">{lastEventLabel ?? ''}</span>
      </button>

      {inspectOpen && lastEvent ? (
        <div className="nostrstack-popover-overlay nostrstack-gallery-popover-overlay" onClick={() => setInspectOpen(false)}>
          <div
            className="nostrstack-popover"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Relay event details"
          >
            <div className="nostrstack-popover-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="nostrstack-popover-title">Relay event</div>
                <div className="nostrstack-popover-sub">
                  {host} · {lastEvent.direction} · {new Date(lastEvent.ts).toLocaleTimeString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectOpen(false)}
                className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
                style={{ borderRadius: 'var(--nostrstack-radius-pill)', padding: '0.25rem 0.6rem' }}
                aria-label="Close relay event details"
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: 'var(--nostrstack-color-text)' }}>{lastEvent.label}</strong>
                {lastEvent.sublabel ? (
                  <div style={{ color: 'var(--nostrstack-color-text-muted)' }}>{lastEvent.sublabel}</div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <JsonView title="Payload" value={lastEvent.payload ?? null} maxHeight={320} collapsible />
                <JsonView
                  title="Relay metadata"
                  value={{
                    url,
                    name: meta?.name,
                    software: meta?.software,
                    version: meta?.version,
                    contact: meta?.contact,
                    pubkey: meta?.pubkey,
                    paymentsUrl: meta?.paymentsUrl,
                    language: meta?.language,
                    tags: meta?.tags,
                    limitation: meta?.limitation,
                    supportedNips: meta?.supportedNips
                  }}
                  maxHeight={320}
                  collapsible
                  defaultCollapsed
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function timeAgo(ts: number, now: number) {
  const diff = now - ts;
  if (diff < 5000) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function buildSparkFromHistory(history: Array<{ ts: number }>, now: number) {
  const windowMs = 60000;
  const bucketMs = 5000;
  const bars = Math.floor(windowMs / bucketMs);
  const counts = Array.from({ length: bars }, () => 0);
  for (const h of history) {
    const age = now - h.ts;
    if (age < 0 || age > windowMs) continue;
    const bucket = Math.min(bars - 1, Math.floor(age / bucketMs));
    const idx = bars - 1 - bucket;
    counts[idx] += 1;
  }
  const max = Math.max(1, ...counts);
  return counts.map((c) => {
    const scaled = Math.sqrt(c / max);
    return 6 + Math.round(18 * scaled);
  });
}

function shortSoftware(s: string) {
  try {
    const u = new URL(s);
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return `git+github.com/${parts[0]}/${parts[1]}`;
    }
    return `${u.hostname}${u.pathname !== '/' ? u.pathname : ''}`.slice(0, 40);
  } catch {
    return s.slice(0, 40);
  }
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatSeconds(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}
