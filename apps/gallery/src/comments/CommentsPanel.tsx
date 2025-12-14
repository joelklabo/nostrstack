import { useEffect, useMemo, useRef, useState } from 'react';

import { Pill } from '../App';
import { RelayCard } from '../RelayCard';
import { RelayRibbon } from '../RelayRibbon';
import type { RelayStats } from '../types/relay';

export function CommentsPanel({
  relayLabel,
  relaysEnvDefault,
  relaysList,
  relayStats
}: {
  relayLabel: string;
  relaysEnvDefault: string[];
  relaysList: string[];
  relayStats: RelayStats;
}) {
  const relaysToShow = useMemo(
    () => (relaysList.length ? relaysList : relaysEnvDefault),
    [relaysEnvDefault, relaysList]
  );
  const [liveBadge, setLiveBadge] = useState<'listening' | 'idle'>('idle');
  const [events, setEvents] = useState<
    Array<{ relay: string; ts: number; recv?: number; sendStatus?: string }>
  >([]);
  const lastSeenRef = useRef<Record<string, number>>({});
  const [ribbonEvents, setRibbonEvents] = useState<
    Array<{ relay: string; ts: number; kind: 'recv' | 'send'; detail?: string }>
  >([]);

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
        setEvents((evts) =>
          [{ relay: r, ts: last, recv: stat?.recv, sendStatus: stat?.sendStatus }, ...evts].slice(
            0,
            40
          )
        );
        const kind: 'recv' | 'send' =
          stat?.sendStatus === 'sending' || stat?.sendStatus === 'ok' ? 'send' : 'recv';
        setRibbonEvents((evts) => [{ relay: r, ts: last, kind }, ...evts].slice(0, 30));
        lastSeenRef.current[r] = last;
      }
    });
  }, [relaysToShow, relayStats]);

  const lastEventTs = events.length ? events[0].ts : null;
  const lastAgo = lastEventTs ? Math.max(0, Math.floor((Date.now() - lastEventTs) / 1000)) : null;

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
                supportedNips: data.supportedNips,
                paymentRequired: data.paymentRequired,
                authRequired: data.authRequired
              }}
              recv={data.recv}
              recvPerMin={data.recvPerMin}
              sendStatus={data.sendStatus}
              last={data.last}
              lastSentAt={data.lastSentAt}
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
              {events.length} events
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEvents([])}
            className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
          >
            Clear feed
          </button>
        </div>
        <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: '0.4rem' }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.95rem' }}>
              Waiting for relay events…
            </div>
          ) : (
            events.map((ev, idx) => (
              <div
                key={`${ev.relay}-${ev.ts}-${idx}`}
                className="nostrstack-card"
                style={{
                  padding: '0.45rem 0.6rem',
                  borderRadius: 'var(--nostrstack-radius-md)',
                  borderColor: 'var(--nostrstack-color-border)',
                  background: 'var(--nostrstack-color-surface-subtle)',
                  boxShadow: 'var(--nostrstack-shadow-sm)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.4rem',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: 'var(--nostrstack-color-text)',
                      wordBreak: 'break-all'
                    }}
                  >
                    {ev.relay}
                  </span>
                  <span style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>
                    recv {ev.recv ?? 0}
                    {ev.sendStatus ? ` • ${ev.sendStatus}` : ''}
                  </span>
                </div>
                <time style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-muted)' }}>
                  {new Date(ev.ts).toLocaleTimeString()}
                </time>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
