import { useMemo } from 'react';

type Props = {
  url: string;
  meta?: { name?: string; software?: string };
  recv?: number;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  last?: number;
  theme?: 'light' | 'dark';
};

export function RelayCard({ url, meta, recv = 0, sendStatus, last, theme = 'light' }: Props) {
  const host = useMemo(() => {
    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch {
      return url;
    }
  }, [url]);

  const palette =
    theme === 'dark'
      ? { card: '#0f172a', text: '#e2e8f0', sub: '#cbd5e1', border: '#1f2937', chip: '#111827' }
      : { card: '#fff', text: '#0f172a', sub: '#475569', border: '#e2e8f0', chip: '#f8fafc' };

  const hot = last && Date.now() - last < 3000;
  const tone =
    sendStatus === 'sending'
      ? { dot: '#0ea5e9', shadow: 'rgba(14,165,233,0.35)', badge: '• sending' }
      : sendStatus === 'ok'
        ? { dot: '#22c55e', shadow: 'rgba(34,197,94,0.35)', badge: '✓ sent' }
        : sendStatus === 'error'
          ? { dot: '#ef4444', shadow: 'rgba(239,68,68,0.35)', badge: '! error' }
          : { dot: '#94a3b8', shadow: 'rgba(148,163,184,0.35)', badge: '' };

  const lastLabel = last ? timeAgo(last) : 'no recent activity';

  return (
    <div
      className="relay-card"
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: '0.55rem 0.7rem',
        background: palette.card,
        boxShadow: '0 8px 24px rgba(15,23,42,0.08)'
      }}
    >
      <style>{`
        @keyframes relay-pulse { 0% { box-shadow: 0 0 0 0 ${tone.shadow}; } 70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.55rem' }}>
        <span
          className={hot ? 'pulse' : ''}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: tone.dot,
            boxShadow: hot ? `0 0 0 6px ${tone.shadow}` : undefined,
            animation: hot ? 'relay-pulse 1.8s infinite' : undefined
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <strong style={{ fontSize: '0.95rem', color: palette.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{host}</strong>
          <span style={{ fontSize: '0.8rem', color: palette.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(meta?.name || '—')}{meta?.software ? ` • ${meta.software}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 110 }}>
          <span style={{ fontSize: '0.8rem', color: palette.text, background: palette.chip, border: `1px solid ${palette.border}`, padding: '0.2rem 0.55rem', borderRadius: 999 }}>
            recv {recv}
          </span>
          {tone.badge && (
            <span style={{ fontSize: '0.75rem', color: tone.dot }}>{tone.badge}</span>
          )}
          <span style={{ fontSize: '0.75rem', color: palette.sub, whiteSpace: 'nowrap' }}>{lastLabel}</span>
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
