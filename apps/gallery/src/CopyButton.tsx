import { useState } from 'react';

type Props = {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
};

export function CopyButton({ text, label = 'Copy', size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch (err) {
      console.warn('copy failed', err);
    }
  };

  const padding = size === 'sm' ? '0.35rem 0.6rem' : '0.45rem 0.75rem';

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding,
        background: copied ? '#22c55e' : '#e2e8f0',
        color: copied ? '#0f172a' : '#0f172a',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: '0.85rem',
        cursor: 'pointer'
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
