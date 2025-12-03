import { useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    const latest = relaysToShow.map((r) => relayStats[r]?.last ?? relayStats[r]?.lastSentAt).filter(Boolean);
    const recent = latest.some((t) => typeof t === 'number' && Date.now() - (t as number) < 5000);
    setLiveBadge(recent ? 'listening' : 'idle');
  }, [relaysToShow, relayStats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Pill label="Mode" value={relayMode === 'mock' ? 'mock (local)' : 'real relays'} tone={relayMode === 'mock' ? 'muted' : 'success'} theme={theme} />
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Relays: {relayLabel}</span>
        <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, border: '1px solid #e2e8f0', background: liveBadge === 'listening' ? '#ecfdf3' : '#f1f5f9', color: liveBadge === 'listening' ? '#166534' : '#475569', fontWeight: 700 }}>
          {liveBadge === 'listening' ? 'Live' : 'Idle'}
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
              last={data.last ?? data.lastSentAt}
              theme={theme}
            />
          );
        })}
      </div>
      {relayMode === 'mock' ? <div id="comments-container" /> : <div id="comments-container" />}
    </div>
  );
}
