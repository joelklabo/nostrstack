import { useState } from 'react';

type Props = {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
};

export function CopyButton({ text, label = 'Copy', size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch (err) {
      console.warn('copy failed', err);
      setError('Copy failed');
      setTimeout(() => setError(null), 2000);
    }
  };

  const padding = size === 'sm' ? '0.35rem 0.6rem' : '0.45rem 0.75rem';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          padding,
          background: copied ? '#22c55e' : '#e2e8f0',
          color: '#0f172a',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          fontSize: '0.85rem',
          cursor: 'pointer'
        }}
      >
        {copied ? 'Copied' : label}
      </button>
      {error && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{error}</span>}
    </div>
  );
}
