import { useEffect, useMemo, useRef, useState } from 'react';

import { Pill } from '../App';
import { RelayCard } from '../RelayCard';
import { RelayRibbon } from '../RelayRibbon';
import type { RelayStats } from '../types/relay';
import { JsonView } from '../ui/JsonView';

export type LiveActivityItem = {
  id: string;
  ts: number;
  relay: string;
  direction: 'recv' | 'send';
  label: string;
  sublabel?: string;
  payload?: unknown;
};

export function CommentsPanel({
  relayLabel,
  relaysEnvDefault,
  relaysList,
  relayStats,
  activity,
  onClearActivity
}: {
  relayLabel: string;
  relaysEnvDefault: string[];
  relaysList: string[];
  relayStats: RelayStats;
  activity: LiveActivityItem[];
  onClearActivity?: () => void;
}) {
  const relaysToShow = useMemo(
    () => (relaysList.length ? relaysList : relaysEnvDefault),
    [relaysEnvDefault, relaysList]
  );
  const [liveBadge, setLiveBadge] = useState<'listening' | 'idle'>('idle');
  const lastSeenRef = useRef<Record<string, number>>({});
  const [ribbonEvents, setRibbonEvents] = useState<
    Array<{ relay: string; ts: number; kind: 'recv' | 'send'; detail?: string }>
  >([]);
  const [selected, setSelected] = useState<LiveActivityItem | null>(null);

  useEffect(() => {
    const latest = relaysToShow
      .map((r) => relayStats[r]?.last ?? relayStats[r]?.lastSentAt)
      .filter(Boolean);
    const recent = latest.some((t) => typeof t === 'number' && Date.now() - (t as number) < 5000);
    setLiveBadge(recent ? 'listening' : 'idle');
  }, [relaysToShow, relayStats]);

  useEffect(() => {
    relaysToShow.forEach((r) => {
      const stat = relayStats[r];
      const last = stat?.last ?? stat?.lastSentAt;
      if (!last) return;
      const prev = lastSeenRef.current[r];
      if (!prev || last !== prev) {
        const kind: 'recv' | 'send' =
          stat?.sendStatus === 'sending' || stat?.sendStatus === 'ok' ? 'send' : 'recv';
        setRibbonEvents((evts) => [{ relay: r, ts: last, kind }, ...evts].slice(0, 30));
        lastSeenRef.current[r] = last;
      }
    });
  }, [relaysToShow, relayStats]);

  const lastEventTs = activity.length ? activity[0].ts : null;
  const lastAgo = lastEventTs ? Math.max(0, Math.floor((Date.now() - lastEventTs) / 1000)) : null;

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Pill label="Mode" value="real relays" tone="success" />
        <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
          Relays: {relayLabel}
        </span>
        <span
          style={{
            padding: '0.25rem 0.55rem',
            borderRadius: 999,
            border: '1px solid var(--nostrstack-color-border)',
            background:
              liveBadge === 'listening'
                ? 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))'
                : 'var(--nostrstack-color-surface-strong)',
            color:
              liveBadge === 'listening'
                ? 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))'
                : 'var(--nostrstack-color-text-muted)',
            fontWeight: 700
          }}
        >
          {liveBadge === 'listening' ? 'Live' : 'Idle'}
          {lastAgo !== null && ` · ${lastAgo}s ago`}
        </span>
      </div>
      <div
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.9rem',
          color: 'var(--nostrstack-color-text-muted)'
        }}
      >
        Posting to real relays needs a NIP-07 signer. Don’t have one?{' '}
        <a href="https://getalby.com" target="_blank" rel="noreferrer">
          Get Alby
        </a>{' '}
        or use{' '}
        <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noreferrer">
          nos2x
        </a>
        .
      </div>
      <div
        style={{
          display: 'grid',
          gap: '0.4rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
        }}
      >
        {relaysToShow.map((r: string) => {
          const data = relayStats[r] ?? { recv: 0 };
          return (
            <RelayCard
              key={r}
              url={r}
              meta={{
                name: data.name,
                software: data.software,
                version: data.version,
                description: data.description,
                icon: data.icon,
                supportedNips: data.supportedNips,
                paymentRequired: data.paymentRequired,
                authRequired: data.authRequired,
                contact: data.contact,
                pubkey: data.pubkey,
                paymentsUrl: data.paymentsUrl,
                language: data.language,
                tags: data.tags,
                limitation: data.limitation
              }}
              recv={data.recv}
              recvPerMin={data.recvPerMin}
              recvHistory={data.recvHistory}
              send={data.send ?? 0}
              sendPerMin={data.sendPerMin}
              sendHistory={data.sendHistory}
              errorCount={data.errorCount ?? 0}
              lastError={data.lastError}
              sendStatus={data.sendStatus}
              last={data.last}
              lastSentAt={data.lastSentAt}
              lastEvent={data.lastEvent}
              latencyMs={data.latencyMs}
              online={data.online}
              lastProbeAt={data.lastProbeAt}
            />
          );
        })}
      </div>
      <RelayRibbon events={ribbonEvents} />
      <div
        className="nostrstack-card"
        style={{
          padding: '0.65rem 0.75rem',
          background: 'var(--nostrstack-color-surface)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            marginBottom: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: 800 }}>Live activity</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
              {activity.length} events
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClearActivity?.()}
            className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
          >
            Clear feed
          </button>
        </div>
        <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: '0.4rem' }}>
          {activity.length === 0 ? (
            <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.95rem' }}>
              Waiting for relay events…
            </div>
          ) : (
            activity.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="nostrstack-activity-item"
                onClick={() => setSelected(ev)}
              >
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0.2rem 0.55rem',
                        borderRadius: 999,
                        border: '1px solid var(--nostrstack-color-border)',
                        background:
                          ev.direction === 'send'
                            ? 'color-mix(in oklab, var(--nostrstack-color-info) 12%, var(--nostrstack-color-surface))'
                            : 'color-mix(in oklab, var(--nostrstack-color-success) 12%, var(--nostrstack-color-surface))',
                        color:
                          ev.direction === 'send'
                            ? 'color-mix(in oklab, var(--nostrstack-color-info) 70%, var(--nostrstack-color-text))'
                            : 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))',
                        fontWeight: 750,
                        fontSize: '0.85rem'
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background:
                            ev.direction === 'send'
                              ? 'var(--nostrstack-color-info)'
                              : 'var(--nostrstack-color-success)'
                        }}
                      />
                      {ev.direction}
                    </span>
                    <span
                      style={{
                        fontWeight: 750,
                        color: 'var(--nostrstack-color-text)',
                        wordBreak: 'break-all',
                        minWidth: 0
                      }}
                      title={ev.relay}
                    >
                      {ev.relay}
                    </span>
                  </div>
                  <span
                    style={{
                      color: 'var(--nostrstack-color-text)',
                      fontSize: '0.92rem',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                    title={ev.label}
                  >
                    {ev.label}
                  </span>
                  {ev.sublabel ? (
                    <span style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.85rem' }}>
                      {ev.sublabel}
                    </span>
                  ) : null}
                </div>
                <time
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--nostrstack-color-text-muted)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {new Date(ev.ts).toLocaleTimeString()}
                </time>
              </button>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <div
          className="nostrstack-popover-overlay nostrstack-gallery-popover-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="nostrstack-popover"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Activity event details"
          >
            <div className="nostrstack-popover-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="nostrstack-popover-title">Activity event</div>
                <div className="nostrstack-popover-sub">
                  {selected.direction} · <code>{selected.relay}</code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
                style={{ borderRadius: 'var(--nostrstack-radius-pill)', padding: '0.25rem 0.6rem' }}
                aria-label="Close activity details"
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: 'var(--nostrstack-color-text)' }}>{selected.label}</strong>
                {selected.sublabel ? (
                  <div style={{ color: 'var(--nostrstack-color-text-muted)' }}>{selected.sublabel}</div>
                ) : null}
              </div>
              <JsonView
                title="Payload"
                value={selected.payload ?? null}
                maxHeight={420}
                collapsible
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
