import { getPublicKey, nip19, utils } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';

function widthBasedKeep(w: number) {
  if (!Number.isFinite(w)) return 10;
  if (w < 480) return 8;
  if (w < 768) return 12;
  if (w < 1200) return 16;
  return 24;
}

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
};

export function NpubBar({ pubkey, seckey }: Props) {
  const [format, setFormat] = useState<'npub' | 'hex'>('npub');
  const [copied, setCopied] = useState(false);
  const [thumbPos, setThumbPos] = useState<'left' | 'right'>('left');
  const [keep, setKeep] = useState(() => widthBasedKeep(typeof window !== 'undefined' ? window.innerWidth : 1024));
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = () => setKeep(widthBasedKeep(window.innerWidth));
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (!barRef.current || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(barRef.current);
    return () => obs.disconnect();
  }, []);

  const keys = useMemo(() => {
    const candidate = pubkey || seckey || '';
    if (!candidate) return { hex: '', npub: '' };

    let hex = '';
    try {
      if (candidate.startsWith('npub')) {
        hex = utils.bytesToHex(nip19.decode(candidate).data as Uint8Array);
      } else if (candidate.startsWith('nsec')) {
        const priv = utils.bytesToHex(nip19.decode(candidate).data as Uint8Array);
        hex = getPublicKey(priv);
      } else if (/^[0-9a-fA-F]{64}$/.test(candidate)) {
        hex = candidate.toLowerCase();
      }
    } catch {
      hex = '';
    }

    let npub = '';
    if (hex) {
      try {
        npub = nip19.npubEncode(hex);
      } catch {
        npub = '';
      }
    }

    return { hex, npub };
  }, [pubkey, seckey]);

  const full = useMemo(() => {
    if (format === 'npub') return keys.npub || keys.hex;
    return keys.hex;
  }, [format, keys.hex, keys.npub]);

  useEffect(() => {
    setThumbPos(format === 'npub' ? 'left' : 'right');
  }, [format]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const truncated = useMemo(() => {
    if (!full) return '—';
    // approximate character width 8px for monospace; leave room for buttons (~200px)
    const available = containerWidth ? Math.max(containerWidth - 220, 40) : null;
    const charLimit = available ? Math.floor(available / 8) : keep * 2 + 5;
    if (full.length <= charLimit) return full;
    const dynKeep = Math.max(6, Math.min(32, Math.floor(charLimit / 2)));
    return middleTruncate(full, dynKeep);
  }, [full, containerWidth, keep]);

  return (
    <div style={wrap}>
      <div style={bar} aria-label="Public key" ref={barRef}>
        <div style={toggleShell} role="group" aria-label="Key format">
          <span aria-hidden style={{ ...thumb, transform: thumbPos === 'left' ? 'translateX(0)' : 'translateX(100%)' }} />
          <button
            type="button"
            onClick={() => setFormat('npub')}
            style={{ ...toggleBtn, color: format === 'npub' ? '#0f172a' : '#64748b' }}
            aria-pressed={format === 'npub'}
          >
            npub
          </button>
          <button
            type="button"
            onClick={() => setFormat('hex')}
            style={{ ...toggleBtn, color: format === 'hex' ? '#0f172a' : '#64748b' }}
            aria-pressed={format === 'hex'}
          >
            hex
          </button>
        </div>
        <span style={text} aria-label={`${format} key`}>
          {truncated}
        </span>
        <button type="button" onClick={handleCopy} style={copy} aria-live="polite" aria-label="Copy key">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={copied ? '#22c55e' : '#0f172a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 120ms ease', opacity: copied ? 0.9 : 1 }}>
            <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
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
  fontSize: '0.96rem',
  color: '#0f172a',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const copy: React.CSSProperties = {
  position: 'relative',
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  color: '#0f172a',
  display: 'grid',
  placeItems: 'center'
};

const toggleShell: React.CSSProperties = {
  display: 'inline-grid',
  gridTemplateColumns: '1fr 1fr',
  position: 'relative',
  borderRadius: 14,
  background: '#e2e8f0',
  padding: 4,
  gap: 4,
  minWidth: 140,
  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08)',
  alignItems: 'center'
};

const thumb: React.CSSProperties = {
  position: 'absolute',
  inset: 4,
  width: 'calc(50% - 4px)',
  borderRadius: 10,
  background: 'linear-gradient(145deg, #fff, #dbeafe)',
  boxShadow: '2px 2px 6px rgba(0,0,0,0.12), -1px -1px 4px rgba(255,255,255,0.9)',
  transition: 'transform 150ms ease, box-shadow 150ms ease',
  zIndex: 0
};

const toggleBtn: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  border: 'none',
  background: 'transparent',
  fontWeight: 800,
  cursor: 'pointer',
  padding: '0.35rem 0.4rem',
  borderRadius: 10,
  fontSize: '0.92rem',
  letterSpacing: '0.01em'
};

function middleTruncate(value: string, keep = 10) {
  if (!value) return value;
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
