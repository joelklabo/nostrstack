import type { HTMLAttributes, ReactNode } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  onRetry?: () => void;
  retryLabel?: string;
}

export function Alert({
  children,
  title,
  tone = 'info',
  className = '',
  style,
  onRetry,
  retryLabel = 'Retry',
  role = 'alert',
  ...props
}: AlertProps) {
  return (
    <div
      className={`ns-alert ns-alert--${tone} ${className}`.trim()}
      style={style}
      role={role}
      {...props}
    >
      {title && <div className="ns-alert__title">{title}</div>}
      <div className="ns-alert__content">
        <div className="ns-alert__body">{children}</div>
        {onRetry && (
          <div style={{ marginTop: 'var(--ns-space-3)' }}>
            <button className="ns-btn ns-btn--ghost" onClick={onRetry}>
              {retryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
