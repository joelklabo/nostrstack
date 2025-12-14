import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { BadgeTone } from './Badge';

const toneVars: Record<BadgeTone, string> = {
  accent: 'var(--nostrstack-color-accent)',
  info: 'var(--nostrstack-color-info)',
  success: 'var(--nostrstack-color-success)',
  warn: 'var(--nostrstack-color-warning)',
  danger: 'var(--nostrstack-color-danger)',
  muted: 'var(--nostrstack-color-text-subtle)'
};

export type CalloutProps = HTMLAttributes<HTMLDivElement> & {
  tone?: BadgeTone;
  heading?: ReactNode;
};

export function Callout({ tone = 'accent', heading, className, style, children, ...props }: CalloutProps) {
  const toneVar = toneVars[tone];
  return (
    <section
      {...props}
      className={['nostrstack-callout', className].filter(Boolean).join(' ')}
      style={{ ...style, '--nostrstack-callout-tone': toneVar } as CSSProperties}
    >
      {heading ? <div className="nostrstack-callout__title">{heading}</div> : null}
      <div className="nostrstack-callout__content">{children}</div>
    </section>
  );
}
