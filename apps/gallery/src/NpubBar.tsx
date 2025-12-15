import { getPublicKey, nip19, utils } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CopyButton } from './CopyButton';

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
        const sk = nip19.decode(candidate).data as Uint8Array;
        hex = getPublicKey(sk);
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
            style={{
              ...toggleBtn,
              color: format === 'npub' ? 'var(--nostrstack-color-text)' : 'var(--nostrstack-color-text-subtle)'
            }}
            aria-pressed={format === 'npub'}
          >
            npub
          </button>
          <button
            type="button"
            onClick={() => setFormat('hex')}
            style={{
              ...toggleBtn,
              color: format === 'hex' ? 'var(--nostrstack-color-text)' : 'var(--nostrstack-color-text-subtle)'
            }}
            aria-pressed={format === 'hex'}
          >
            hex
          </button>
        </div>
        <span style={text} aria-label={`${format} key`}>
          {truncated}
        </span>
        <CopyButton
          text={full}
          label="Copy key"
          size="sm"
          variant="icon"
          ariaLabel="Copy key"
        />
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
  background: 'var(--nostrstack-color-surface-subtle)',
  borderRadius: 'var(--nostrstack-radius-lg)',
  border: '1px solid var(--nostrstack-color-border)',
  padding: '0.45rem 0.65rem',
  boxShadow: 'var(--nostrstack-shadow-md)',
  position: 'relative',
  overflow: 'hidden'
};

const text: React.CSSProperties = {
  fontFamily: 'var(--nostrstack-font-mono)',
  fontSize: '0.96rem',
  color: 'var(--nostrstack-color-text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const toggleShell: React.CSSProperties = {
  display: 'inline-grid',
  gridTemplateColumns: '1fr 1fr',
  position: 'relative',
  borderRadius: 'var(--nostrstack-radius-lg)',
  background: 'var(--nostrstack-color-surface-strong)',
  border: '1px solid var(--nostrstack-color-border)',
  padding: 4,
  gap: 4,
  minWidth: 140,
  boxShadow: 'inset 0 2px 6px color-mix(in oklab, var(--nostrstack-color-text) 12%, transparent)',
  alignItems: 'center'
};

const thumb: React.CSSProperties = {
  position: 'absolute',
  inset: 4,
  width: 'calc(50% - 4px)',
  borderRadius: 'var(--nostrstack-radius-md)',
  background:
    'linear-gradient(145deg, var(--nostrstack-color-surface), color-mix(in oklab, var(--nostrstack-color-primary-soft) 55%, var(--nostrstack-color-surface)))',
  boxShadow: 'var(--nostrstack-shadow-sm)',
  transition:
    'transform var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard), box-shadow var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard), background var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard)',
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
