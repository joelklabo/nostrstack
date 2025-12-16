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

  const fullValue = useMemo(() => {
    const key = showPriv ? seckey : pubkey;
    if (!key) return '';
    if (format === 'npub') {
      try {
        return showPriv ? nip19.nsecEncode(utils.hexToBytes(key)) : nip19.npubEncode(key);
      } catch {
        return key;
      }
    }
    return key;
  }, [format, pubkey, seckey, showPriv]);

  const display = useMemo(() => {
    if (!fullValue) return '—';
    return middleTruncate(fullValue, 12);
  }, [fullValue]);

  return (
    <div style={wrapper}>
      <div style={toolbar}>
        <button onClick={() => setShowPriv((v) => !v)} style={pillBtn}>
          {showPriv ? 'Show pub' : 'Show priv'}
        </button>
        <select
          className="nostrstack-select"
          name="keyToggleFormat"
          value={format}
          onChange={(e) => setFormat(e.target.value as 'hex' | 'npub')}
          style={{ width: 'auto', minWidth: 132 }}
        >
          <option value="npub">npub/nsec</option>
          <option value="hex">hex</option>
        </select>
        <CopyButton text={fullValue} label="Copy" />
      </div>
      <div style={codeBox}>
        <code>{display}</code>
      </div>
    </div>
  );
}

const wrapper: React.CSSProperties = {
  border: '1px solid var(--nostrstack-color-border)',
  borderRadius: 'var(--nostrstack-radius-lg)',
  padding: '0.75rem',
  background: 'var(--nostrstack-color-surface-subtle)'
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
  border: '1px solid var(--nostrstack-color-border-strong)',
  background: 'var(--nostrstack-color-surface)',
  color: 'var(--nostrstack-color-text)',
  fontWeight: 700
};

const codeBox: React.CSSProperties = {
  fontFamily: 'var(--nostrstack-font-mono)',
  wordBreak: 'break-word',
  fontSize: '0.9rem',
  color: 'var(--nostrstack-color-text)',
  padding: '0.35rem 0.6rem',
  background: 'var(--nostrstack-color-surface)',
  borderRadius: 10,
  border: '1px solid var(--nostrstack-color-border)',
  minHeight: 34
};

function middleTruncate(value: string, keep = 10) {
  if (!value) return value;
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
