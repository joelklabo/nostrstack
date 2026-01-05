import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
  style?: React.CSSProperties;
  onRetry?: () => void;
  retryLabel?: string;
}

export function Alert({ children, title, tone = 'info', className = '', style, onRetry, retryLabel = 'Retry' }: AlertProps) {
  return (
    <div 
      className={`nostrstack-alert nostrstack-alert--${tone} ${className}`} 
      style={style}
      role="alert"
    >
      {title && <div className="nostrstack-alert__title">{title}</div>}
      <div className="nostrstack-alert__body">
        {children}
        {onRetry && (
          <div style={{ marginTop: '0.75rem' }}>
            <button 
              className="action-btn" 
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
