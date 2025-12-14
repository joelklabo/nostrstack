import type { CSSProperties, HTMLAttributes } from 'react';

export type BadgeTone = 'accent' | 'info' | 'success' | 'warn' | 'danger' | 'muted';

const toneVars: Record<BadgeTone, string> = {
  accent: 'var(--nostrstack-color-accent)',
  info: 'var(--nostrstack-color-info)',
  success: 'var(--nostrstack-color-success)',
  warn: 'var(--nostrstack-color-warning)',
  danger: 'var(--nostrstack-color-danger)',
  muted: 'var(--nostrstack-color-text-subtle)'
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = 'muted', className, style, ...props }: BadgeProps) {
  const toneVar = toneVars[tone];
  return (
    <span
      {...props}
      className={['nostrstack-badge', className].filter(Boolean).join(' ')}
      style={{ ...style, '--nostrstack-badge-tone': toneVar } as CSSProperties}
    />
  );
}
