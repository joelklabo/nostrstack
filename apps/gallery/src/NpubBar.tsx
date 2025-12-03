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
      <div style={chip}>
        <button
          type="button"
          onClick={() => setFormat((f) => (f === 'npub' ? 'hex' : 'npub'))}
          style={{ ...toggle, background: format === 'npub' ? '#eef2ff' : '#fff' }}
          aria-label="Toggle npub/hex"
        >
          {format === 'npub' ? 'npub' : 'hex'}
        </button>
        <div style={bar} aria-label="Public key">
          <span style={text}>{short || '—'}</span>
          <button type="button" onClick={handleCopy} style={copy} aria-live="polite">
            <span style={{ opacity: copied ? 0 : 1, transition: 'opacity 120ms ease' }}>⧉</span>
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: copied ? 1 : 0, color: '#22c55e', fontWeight: 800, transition: 'opacity 120ms ease' }}>✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: '100%'
};

const chip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
  alignItems: 'center'
};

const toggle: React.CSSProperties = {
  padding: '0.4rem 0.65rem',
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
