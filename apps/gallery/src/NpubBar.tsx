import { getPublicKey, nip19, utils } from 'nostr-tools';
import { useEffect, useMemo, useState } from 'react';

function widthBasedKeep(w: number) {
  if (!Number.isFinite(w)) return 10;
  if (w < 480) return 6;
  if (w < 768) return 8;
  if (w < 1200) return 10;
  return 12;
}

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
};

export function NpubBar({ pubkey, seckey }: Props) {
  const [format, setFormat] = useState<'npub' | 'hex'>('npub');
  const [copied, setCopied] = useState(false);
  const [keep, setKeep] = useState(() => widthBasedKeep(typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    const handler = () => setKeep(widthBasedKeep(window.innerWidth));
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }
    return () => {};
  }, []);

  const hexPub = useMemo(() => {
    const candidate = pubkey || seckey || '';
    if (!candidate) return '';
    try {
      if (candidate.startsWith('npub')) {
        return utils.bytesToHex(nip19.decode(candidate).data as Uint8Array);
      }
      if (candidate.startsWith('nsec')) {
        const priv = utils.bytesToHex(nip19.decode(candidate).data as Uint8Array);
        return getPublicKey(priv);
      }
      if (/^[0-9a-fA-F]{64}$/.test(candidate)) return candidate.toLowerCase();
      return '';
    } catch {
      return '';
    }
  }, [pubkey, seckey]);

  const full = useMemo(() => {
    if (!hexPub) return '';
    try {
      if (format === 'npub') return nip19.npubEncode(utils.hexToBytes(hexPub));
      return hexPub;
    } catch {
      return hexPub;
    }
  }, [format, hexPub]);

  const short = useMemo(() => middleTruncate(full, keep), [full, keep]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div style={wrap}>
      <div style={bar} aria-label="Public key">
        <button
          type="button"
          onClick={() => setFormat((f) => (f === 'npub' ? 'hex' : 'npub'))}
          style={{ ...toggle, background: format === 'npub' ? '#e0e7ff' : '#fff' }}
          aria-label="Toggle npub/hex"
        >
          {format === 'npub' ? 'npub' : 'hex'}
        </button>
        <span style={text}>{short || '—'}</span>
        <button type="button" onClick={handleCopy} style={copy} aria-live="polite" aria-label="Copy key">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={copied ? '#22c55e' : '#0f172a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 120ms ease', opacity: copied ? 0.9 : 1 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: copied ? 1 : 0, color: '#22c55e', fontWeight: 800, transition: 'opacity 120ms ease' }}>✓</span>
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: '100%'
};

const toggle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  cursor: 'pointer',
  fontWeight: 700,
  color: '#0f172a',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  minWidth: 70
};

const bar: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 10,
  background: '#f8fafc',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  padding: '0.45rem 0.65rem',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px rgba(15,23,42,0.06)',
  position: 'relative',
  overflow: 'hidden'
};

const text: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.92rem',
  color: '#0f172a',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const copy: React.CSSProperties = {
  position: 'relative',
  width: 38,
  height: 38,
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
