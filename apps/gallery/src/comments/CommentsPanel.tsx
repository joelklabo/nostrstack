import { useEffect, useMemo, useRef, useState } from 'react';

import { Pill } from '../App';
import { RelayCard } from '../RelayCard';

 type RelayStats = Record<string, { recv: number; last?: number; name?: string; software?: string; sendStatus?: 'idle' | 'sending' | 'ok' | 'error'; sendMessage?: string; lastSentAt?: number }>;

export function CommentsPanel({
  relayMode,
  relayLabel,
  relaysEnvDefault,
  relaysList,
  relayStats,
  theme
}: {
  relayMode: 'mock' | 'real';
  relayLabel: string;
  relaysEnvDefault: string[];
  relaysList: string[];
  relayStats: RelayStats;
  theme: 'light' | 'dark';
}) {
  const relaysToShow = useMemo(() => (relaysList.length ? relaysList : relaysEnvDefault), [relaysEnvDefault, relaysList]);
  const [liveBadge, setLiveBadge] = useState<'listening' | 'idle'>('idle');
  const [events, setEvents] = useState<Array<{ relay: string; ts: number; recv?: number; sendStatus?: string }>>([]);
  const lastSeenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const latest = relaysToShow.map((r) => relayStats[r]?.last ?? relayStats[r]?.lastSentAt).filter(Boolean);
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
        setEvents((evts) => [{ relay: r, ts: last, recv: stat?.recv, sendStatus: stat?.sendStatus }, ...evts].slice(0, 40));
        lastSeenRef.current[r] = last;
      }
    });
  }, [relaysToShow, relayStats]);

  const lastEventTs = events.length ? events[0].ts : null;
  const lastAgo = lastEventTs ? Math.max(0, Math.floor((Date.now() - lastEventTs) / 1000)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Pill label="Mode" value={relayMode === 'mock' ? 'mock (local)' : 'real relays'} tone={relayMode === 'mock' ? 'muted' : 'success'} theme={theme} />
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Relays: {relayLabel}</span>
        <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, border: '1px solid #e2e8f0', background: liveBadge === 'listening' ? '#ecfdf3' : '#f1f5f9', color: liveBadge === 'listening' ? '#166534' : '#475569', fontWeight: 700 }}>
          {liveBadge === 'listening' ? 'Live' : 'Idle'}
          {lastAgo !== null && ` · ${lastAgo}s ago`}
        </span>
      </div>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
        Posting to real relays needs a NIP-07 signer. Don’t have one? <a href="https://getalby.com" target="_blank" rel="noreferrer">Get Alby</a> or use <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noreferrer">nos2x</a>. For offline/local comments, set relays to <code>mock</code> (no relay writes).
      </div>
      <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {relaysToShow.map((r: string) => {
          const data = relayStats[r] ?? { recv: 0 };
          return (
            <RelayCard
              key={r}
              url={r}
              meta={{ name: data.name, software: data.software }}
              recv={data.recv}
              sendStatus={data.sendStatus}
              last={data.last}
              lastSentAt={data.lastSentAt}
              theme={theme}
            />
          );
        })}
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.65rem 0.75rem', background: theme === 'dark' ? '#0f172a' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: 800 }}>Live activity</span>
            <span style={{ fontSize: '0.9rem', color: '#475569' }}>{events.length} events</span>
          </div>
          <button type="button" onClick={() => setEvents([])} style={{ border: '1px solid #e2e8f0', background: 'transparent', borderRadius: 8, padding: '0.3rem 0.65rem' }}>
            Clear feed
          </button>
        </div>
        <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: '0.4rem' }}>
          {events.length === 0 ? (
            <div style={{ color: '#475569', fontSize: '0.95rem' }}>Waiting for relay events…</div>
          ) : (
            events.map((ev, idx) => (
              <div
                key={`${ev.relay}-${ev.ts}-${idx}`}
                style={{
                  padding: '0.45rem 0.6rem',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: theme === 'dark' ? '#111827' : '#f8fafc',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.4rem',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' }}>{ev.relay}</span>
                  <span style={{ color: '#475569', fontSize: '0.9rem' }}>
                    recv {ev.recv ?? 0}{ev.sendStatus ? ` • ${ev.sendStatus}` : ''}
                  </span>
                </div>
                <time style={{ fontSize: '0.85rem', color: '#475569' }}>{new Date(ev.ts).toLocaleTimeString()}</time>
              </div>
            ))
          )}
        </div>
      </div>
      {relayMode === 'mock' ? <div id="comments-container" /> : <div id="comments-container" />}
    </div>
  );
}
