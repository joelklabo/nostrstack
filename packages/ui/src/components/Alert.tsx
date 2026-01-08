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
      className={`nostrstack-alert nostrstack-alert--${tone} ${className}`}
      style={style}
      role={role}
      {...props}
    >
      {title && <div className="nostrstack-alert__title">{title}</div>}
      <div className="nostrstack-alert__body">
        {children}
        {onRetry && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              className="nostrstack-btn nostrstack-btn--ghost"
              onClick={onRetry}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderColor: 'currentColor',
                color: 'inherit',
                opacity: 0.9
              }}
            >
              {retryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
