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
          background: copied ? 'var(--nostrstack-color-success)' : 'var(--nostrstack-color-surface-strong)',
          color: copied ? 'var(--nostrstack-color-text-on-strong)' : 'var(--nostrstack-color-text)',
          border: copied
            ? '1px solid color-mix(in oklab, var(--nostrstack-color-success) 45%, var(--nostrstack-color-border))'
            : '1px solid var(--nostrstack-color-border-strong)',
          borderRadius: 8,
          fontSize: '0.85rem',
          cursor: 'pointer'
        }}
      >
        {copied ? 'Copied' : label}
      </button>
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--nostrstack-color-danger)' }}>{error}</span>}
    </div>
  );
}
