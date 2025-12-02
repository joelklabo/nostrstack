import { useMemo, useState } from 'react';
import { nip19 } from 'nostr-tools';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
  defaultPriv?: boolean;
  compact?: boolean;
};

export function KeyChip({ pubkey, seckey, defaultPriv = false, compact = true }: Props) {
  const [showPriv, setShowPriv] = useState(defaultPriv);
  const [format, setFormat] = useState<'hex' | 'npub'>('npub');

  const display = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '—';
    try {
      if (format === 'npub') {
        const encoded = showPriv ? nip19.nsecEncode(key as any) : nip19.npubEncode(key as any);
        return truncate(encoded);
      }
      return truncate(key);
    } catch {
      return truncate(key);
    }
  }, [format, pubkey, seckey, showPriv]);

  const fullValue = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '';
    try {
      return format === 'npub' ? (showPriv ? nip19.nsecEncode(key as any) : nip19.npubEncode(key as any)) : key;
    } catch {
      return key;
    }
  }, [format, pubkey, seckey, showPriv]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '6px 10px' : '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, fontSize: '0.9rem' }}>
        <button
          type="button"
          onClick={() => setShowPriv((v) => !v)}
          style={{ border: 'none', background: '#e2e8f0', borderRadius: 999, padding: '2px 10px', fontWeight: 700, cursor: 'pointer' }}
        >
          {showPriv ? 'Priv' : 'Pub'}
        </button>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'hex' | 'npub')} style={{ border: 'none', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}>
          <option value="npub">npub/nsec</option>
          <option value="hex">hex</option>
        </select>
        <code style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{display}</code>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(fullValue)}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
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
