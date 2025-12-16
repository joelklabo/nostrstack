import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { CopyButton } from './CopyButton';

export type JsonViewProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
  value: unknown;
  maxHeight?: number;
  copyLabel?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export function JsonView({
  title,
  value,
  maxHeight = 220,
  copyLabel = 'Copy',
  collapsible = false,
  defaultCollapsed = false,
  className,
  style,
  ...props
}: JsonViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const formatted = useMemo(() => formatValue(value), [value]);
  const canCopy = formatted.canCopy;
  const isCollapsed = collapsible && collapsed;
  const maxHeightVar = isCollapsed ? `${maxHeight}px` : 'none';

  return (
    <div
      {...props}
      className={['nostrstack-json', className].filter(Boolean).join(' ')}
      style={{ ...style, '--nostrstack-json-max-height': maxHeightVar } as CSSProperties}
    >
      {title ? (
        <div className="nostrstack-json__head">
          <strong className="nostrstack-json__title">{title}</strong>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {collapsible ? (
              <button
                type="button"
                className="nostrstack-btn nostrstack-btn--sm"
                onClick={() => setCollapsed((v) => !v)}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            ) : null}
            {canCopy ? <CopyButton text={formatted.copyText} label={copyLabel} /> : null}
          </div>
        </div>
      ) : null}
      <pre className="nostrstack-json__pre">{formatted.text}</pre>
    </div>
  );
}

function formatValue(value: unknown): { text: string; canCopy: boolean; copyText: string } {
  if (value == null) {
    return { text: '—', canCopy: false, copyText: '' };
  }

  if (value instanceof Error) {
    const text = value.stack || value.message || String(value);
    return { text, canCopy: Boolean(text.trim()), copyText: text };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { text: '—', canCopy: false, copyText: '' };
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const pretty = JSON.stringify(parsed, null, 2);
        return { text: pretty, canCopy: true, copyText: pretty };
      } catch {
        // fall through to raw text
      }
    }
    return { text: value, canCopy: true, copyText: value };
  }

  try {
    const pretty = JSON.stringify(value, null, 2);
    return { text: pretty, canCopy: Boolean(pretty.trim()), copyText: pretty };
  } catch {
    const text = String(value);
    return { text, canCopy: Boolean(text.trim()), copyText: text };
  }
}
