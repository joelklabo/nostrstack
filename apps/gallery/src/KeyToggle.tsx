import { useMemo, useState } from 'react';
import { nip19 } from 'nostr-tools';

type Props = {
  pubkey?: string | null;
  seckey?: string | null;
};

export function KeyToggle({ pubkey, seckey }: Props) {
  const [showPriv, setShowPriv] = useState(false);
  const [format, setFormat] = useState<'hex' | 'npub'>('npub');

  const display = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '—';
    if (format === 'npub') {
      try {
        const encoded = showPriv ? nip19.nsecEncode(key as any) : nip19.npubEncode(key as any);
        return encoded;
      } catch {
        return key;
      }
    }
    return key;
  }, [format, pubkey, seckey, showPriv]);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.5rem 0.75rem', background: '#f8fafc' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', alignItems: 'center' }}>
        <button onClick={() => setShowPriv((v) => !v)}>{showPriv ? 'Show pub' : 'Show priv'}</button>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'hex' | 'npub')}>
          <option value="npub">npub/nsec</option>
          <option value="hex">hex</option>
        </select>
      </div>
      <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.9rem', color: '#0f172a' }}>{display}</div>
    </div>
  );
}
