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

  const toggleLabel = format === 'npub' ? 'npub' : 'hex';
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
          <button
            type="button"
            onClick={() => setFormat('npub')}
            style={{ ...toggle, ...(format === 'npub' ? toggleActive : toggleInactive) }}
            aria-pressed={format === 'npub'}
          >
            npub
          </button>
          <button
            type="button"
            onClick={() => setFormat('hex')}
            style={{ ...toggle, ...(format === 'hex' ? toggleActive : toggleInactive) }}
            aria-pressed={format === 'hex'}
          >
            hex
          </button>
        </div>
        <span style={text} aria-label={`${toggleLabel} key`}>
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
  display: 'inline-flex',
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};

const toggleActive: React.CSSProperties = {
  background: '#e0e7ff',
  color: '#111827',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)'
};

const toggleInactive: React.CSSProperties = {
  background: '#fff',
  color: '#475569'
};

function middleTruncate(value: string, keep = 10) {
  if (!value) return value;
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
