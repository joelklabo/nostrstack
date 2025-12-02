import { useMemo } from 'react';

type Props = {
  url: string;
  meta?: { name?: string; software?: string };
  recv?: number;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  last?: number;
};

export function RelayCard({ url, meta, recv = 0, sendStatus, last }: Props) {
  const host = useMemo(() => {
    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch {
      return url;
    }
  }, [url]);

  const hot = last && Date.now() - last < 3000;
  const tone =
    sendStatus === 'sending'
      ? { dot: '#0ea5e9', shadow: 'rgba(14,165,233,0.35)', badge: '• sending' }
      : sendStatus === 'ok'
        ? { dot: '#22c55e', shadow: 'rgba(34,197,94,0.35)', badge: '✓ sent' }
        : sendStatus === 'error'
          ? { dot: '#ef4444', shadow: 'rgba(239,68,68,0.35)', badge: '! error' }
          : { dot: '#94a3b8', shadow: 'rgba(148,163,184,0.35)', badge: '' };

  return (
    <div className="relay-card" style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.5rem 0.65rem', background: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.5rem' }}>
        <span
          className={hot ? 'pulse' : ''}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: tone.dot,
            boxShadow: hot ? `0 0 0 8px ${tone.shadow}` : undefined
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <strong style={{ fontSize: '0.95rem' }}>{host}</strong>
          <span style={{ fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(meta?.name || '—')}{meta?.software ? ` • ${meta.software}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', color: '#0f172a', background: '#e2e8f0', padding: '0.15rem 0.45rem', borderRadius: 999 }}>
            recv {recv}
          </span>
          {tone.badge && (
            <span style={{ fontSize: '0.75rem', color: tone.dot }}>{tone.badge}</span>
          )}
        </div>
      </div>
    </div>
  );
}
