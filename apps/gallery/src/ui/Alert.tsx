import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
  style?: React.CSSProperties;
}

export function Alert({ children, title, tone = 'info', className = '', style }: AlertProps) {
  return (
    <div 
      className={`nostrstack-alert nostrstack-alert--${tone} ${className}`} 
      style={style}
      role="alert"
    >
      {title && <div className="nostrstack-alert__title">{title}</div>}
      <div className="nostrstack-alert__body">{children}</div>
    </div>
  );
}
