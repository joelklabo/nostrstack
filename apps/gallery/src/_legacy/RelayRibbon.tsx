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
        <div
          key={`${ev.relay}-${ev.ts}-${idx}`}
          style={{
            ...pill,
            background:
              ev.kind === 'send'
                ? 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))'
                : 'color-mix(in oklab, var(--nostrstack-color-info) 14%, var(--nostrstack-color-surface))',
            borderColor:
              ev.kind === 'send'
                ? 'color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border))'
                : 'color-mix(in oklab, var(--nostrstack-color-info) 35%, var(--nostrstack-color-border))'
          }}
        >
          <span
            style={{
              color:
                ev.kind === 'send'
                  ? 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))'
                  : 'color-mix(in oklab, var(--nostrstack-color-info) 70%, var(--nostrstack-color-text))',
              fontWeight: 700
            }}
          >
            {ev.kind}
          </span>
          <span
            style={{
              color: 'var(--nostrstack-color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 140
            }}
          >
            {host(ev.relay)}
          </span>
          <span style={{ color: 'var(--nostrstack-color-text-muted)' }}>{timeAgo(ev.ts)}</span>
        </div>
      ))}
      {visible.length === 0 && (
        <span style={{ color: 'var(--nostrstack-color-text-subtle)', fontSize: '0.9rem' }}>
          Waiting for relay events…
        </span>
      )}
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
  border: '1px solid var(--nostrstack-color-border)',
  whiteSpace: 'nowrap',
  boxShadow: 'var(--nostrstack-shadow-sm)'
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
