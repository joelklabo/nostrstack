import { nip19, utils } from 'nostr-tools';
import { useMemo, useState } from 'react';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  defaultPriv?: boolean;
  compact?: boolean;
  mode?: 'toggle' | 'npub-hex-toggle';
  style?: React.CSSProperties;
  className?: string;
};

export function KeyChip({ pubkey, seckey, defaultPriv = false, compact = true, style, className }: Props) {
  const [showPriv] = useState(defaultPriv);
  const [format, setFormat] = useState<'hex' | 'npub'>('npub');

  const display = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '—';
    try {
      if (format === 'npub') {
        const encoded = showPriv ? nip19.nsecEncode(utils.hexToBytes(key)) : nip19.npubEncode(key);
        return truncate(encoded, 6);
      }
      return truncate(key, 6);
    } catch {
      return truncate(key, 6);
    }
  }, [format, pubkey, seckey, showPriv]);

  const fullValue = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '';
    try {
      return format === 'npub' ? (showPriv ? nip19.nsecEncode(utils.hexToBytes(key)) : nip19.npubEncode(key)) : key;
    } catch {
      return key;
    }
  }, [format, pubkey, seckey, showPriv]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%', ...style }} className={className}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: compact ? '6px 10px' : '8px 12px',
          background: 'var(--nostrstack-color-surface-subtle)',
          border: '1px solid var(--nostrstack-color-border)',
          borderRadius: 999,
          fontSize: '0.9rem',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden'
        }}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, cursor: 'pointer' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-muted)' }}>
            {format === 'npub' ? 'npub/nsec' : 'hex'}
          </span>
          <input
            type="checkbox"
            aria-label="Toggle key format"
            name="keyChipHexToggle"
            checked={format === 'hex'}
            onChange={(e) => setFormat(e.target.checked ? 'hex' : 'npub')}
            style={{ accentColor: 'var(--nostrstack-color-primary)', width: 16, height: 16, cursor: 'pointer' }}
          />
        </label>
        <code
          style={{
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            display: 'block'
          }}
        >
          {display}
        </code>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(fullValue)}
        className="nostrstack-btn nostrstack-btn--sm"
        style={{ flexShrink: 0 }}
      >
        Copy
      </button>
    </div>
  );
}

function truncate(value: string, keep = 8) {
  if (!value) return value;
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
