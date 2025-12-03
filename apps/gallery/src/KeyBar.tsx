import { nip19 } from 'nostr-tools';
import { useMemo, useState } from 'react';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  defaultFormat?: 'npub' | 'hex';
};

export function KeyBar({ pubkey, seckey, defaultFormat = 'npub' }: Props) {
  const [format, setFormat] = useState<'npub' | 'hex'>(defaultFormat);
  const [copied, setCopied] = useState(false);

  const display = useMemo(() => {
    const key = pubkey || seckey || '';
    if (!key) return '';
    try {
      if (format === 'npub') return seckey ? nip19.nsecEncode(key) : nip19.npubEncode(key);
      return key;
    } catch {
      return key;
    }
  }, [format, pubkey, seckey]);

  const short = useMemo(() => middleTruncate(display, format === 'npub' ? 12 : 10), [display, format]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore copy failure
    }
  };

  return (
    <div style={wrapper}>
      <div style={pill}>
        <button
          type="button"
          onClick={() => setFormat((f) => (f === 'npub' ? 'hex' : 'npub'))}
          style={{ ...toggleBtn, background: format === 'npub' ? '#eef2ff' : '#fff' }}
          aria-label="Toggle key format npub/hex"
        >
          {format === 'npub' ? 'npub/nsec' : 'hex'}
        </button>
        <div style={bar} role="group" aria-label="Public key">
          <span style={keyText}>{short || '—'}</span>
          <button type="button" onClick={handleCopy} style={copyBtn} aria-live="polite" aria-label="Copy key">
            <span style={{ opacity: copied ? 0 : 1, transition: 'opacity 120ms ease' }}>⧉</span>
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: copied ? 1 : 0, color: '#22c55e', fontWeight: 800, transition: 'opacity 120ms ease' }}>✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const wrapper: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

const pill: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'center',
  gap: 8,
  width: '100%'
};

const toggleBtn: React.CSSProperties = {
  padding: '0.45rem 0.65rem',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  cursor: 'pointer',
  fontWeight: 700,
  color: '#0f172a'
};

const bar: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  background: '#f8fafc',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  padding: '0.45rem 0.6rem',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px rgba(15,23,42,0.06)',
  position: 'relative',
  overflow: 'hidden'
};

const keyText: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.92rem',
  color: '#0f172a',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const copyBtn: React.CSSProperties = {
  position: 'relative',
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  color: '#0f172a',
  display: 'grid',
  placeItems: 'center'
};

function middleTruncate(value: string, keep = 10) {
  if (!value) return value;
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
