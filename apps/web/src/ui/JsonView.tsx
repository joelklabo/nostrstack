import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useId, useMemo, useState } from 'react';

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
  const contentId = useId();
  const formatted = useMemo(() => formatValue(value), [value]);
  const highlighted = useMemo(() => highlightJson(formatted.text), [formatted.text]);
  const canCopy = formatted.canCopy;
  const isCollapsed = collapsible && collapsed;
  const maxHeightVar = isCollapsed ? `${maxHeight}px` : 'none';

  return (
    <div
      {...props}
      className={['ns-json', className].filter(Boolean).join(' ')}
      style={{ ...style, '--ns-json-max-height': maxHeightVar } as CSSProperties}
    >
      {title ? (
        <div className="ns-json__head">
          <strong className="ns-json__title">{title}</strong>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {collapsible ? (
              <button
                type="button"
                className="ns-btn ns-btn--sm"
                onClick={() => setCollapsed((v) => !v)}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
              >
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            ) : null}
            {canCopy ? (
              <CopyButton text={formatted.copyText} label={copyLabel} variant="icon" size="sm" />
            ) : null}
          </div>
        </div>
      ) : null}
      <pre
        id={contentId}
        className="ns-json__pre"
        role="region"
        aria-label="JSON content"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightJson(json: string) {
  if (!json || json === '—') return json;
  const escaped = escapeHtml(json);
  /* eslint-disable security/detect-unsafe-regex -- JSON syntax highlighter regex is safe for trusted input */
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    /* eslint-enable security/detect-unsafe-regex */
    (match) => {
      let cls = 'json-number';
      if (/^&quot;/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
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
