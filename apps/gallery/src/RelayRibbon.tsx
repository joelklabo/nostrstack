import { useEffect, useState } from 'react';

type EventItem = { relay: string; ts: number; kind: 'recv' | 'send'; detail?: string };

export function RelayRibbon({ events }: { events: EventItem[] }) {
  const [visible, setVisible] = useState<EventItem[]>([]);

  useEffect(() => {
    setVisible(events.slice(0, 12));
  }, [events]);

  return (
    <div style={wrap}>
      {visible.map((ev, idx) => (
        <div key={`${ev.relay}-${ev.ts}-${idx}`} style={{ ...pill, background: ev.kind === 'send' ? '#ecfdf3' : '#e0f2fe', borderColor: ev.kind === 'send' ? '#bbf7d0' : '#bae6fd' }}>
          <span style={{ color: ev.kind === 'send' ? '#166534' : '#0ea5e9', fontWeight: 700 }}>{ev.kind}</span>
          <span style={{ color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{host(ev.relay)}</span>
          <span style={{ color: '#475569' }}>{timeAgo(ev.ts)}</span>
        </div>
      ))}
      {visible.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Waiting for relay events…</span>}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  padding: '0.35rem 0.25rem'
};

const pill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.35rem 0.6rem',
  borderRadius: 999,
  border: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(15,23,42,0.08)'
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function host(url: string) {
  try {
    return new URL(url.replace(/^ws/, 'http')).host;
  } catch {
    return url;
  }
}
