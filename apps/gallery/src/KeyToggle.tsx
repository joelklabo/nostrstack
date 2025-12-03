import { nip19, utils } from 'nostr-tools';
import { useMemo, useState } from 'react';

import { CopyButton } from './CopyButton';

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
        const encoded = showPriv ? nip19.nsecEncode(utils.hexToBytes(key)) : nip19.npubEncode(key);
        return middleTruncate(encoded, 12);
      } catch {
        return middleTruncate(key, 12);
      }
    }
    return middleTruncate(key, 12);
  }, [format, pubkey, seckey, showPriv]);

  return (
    <div style={wrapper}>
      <div style={toolbar}>
        <button onClick={() => setShowPriv((v) => !v)} style={pillBtn}>
          {showPriv ? 'Show pub' : 'Show priv'}
        </button>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'hex' | 'npub')} style={selectStyle}>
          <option value="npub">npub/nsec</option>
          <option value="hex">hex</option>
        </select>
        <CopyButton text={display ?? ''} label="Copy" />
      </div>
      <div style={codeBox}>
        <code>{display}</code>
      </div>
    </div>
  );
}

const wrapper: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '0.75rem',
  background: '#f8fafc'
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '0.35rem',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const pillBtn: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  borderRadius: 999,
  border: '1px solid #cbd5e1',
  background: '#fff',
  fontWeight: 700
};

const selectStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#fff'
};

const codeBox: React.CSSProperties = {
  fontFamily: 'monospace',
  wordBreak: 'break-word',
  fontSize: '0.9rem',
  color: '#0f172a',
  padding: '0.35rem 0.6rem',
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  minHeight: 34
};

function middleTruncate(value: string, keep = 10) {
  if (!value) return value;
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
