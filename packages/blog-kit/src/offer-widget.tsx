"use client";

import { QRCodeSVG } from 'qrcode.react';
import type { ReactNode } from 'react';

export type OfferWidgetProps = {
  title: string;
  value: string;
  subtitle?: string;
  status?: string;
  copyLabel?: string;
  onCopy?: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function OfferWidget({
  title,
  value,
  subtitle,
  status,
  copyLabel = 'COPY',
  onCopy,
  actions,
  footer,
  className
}: OfferWidgetProps) {
  return (
    <div className={`offer-widget${className ? ` ${className}` : ''}`}>
      <div className="offer-widget__header">
        <div className="offer-widget__heading">
          <div className="offer-widget__title">{title}</div>
          {subtitle && <div className="offer-widget__subtitle">{subtitle}</div>}
        </div>
        {status && <div className="offer-widget__status">{status}</div>}
      </div>

      <div className="offer-widget__body">
        <div className="offer-widget__qr">
          <QRCodeSVG value={value} size={140} bgColor="#ffffff" fgColor="#0f172a" level="L" />
        </div>
        <div className="offer-widget__content">
          <div className="offer-widget__value">{value}</div>
          <div className="offer-widget__actions">
            {onCopy && (
              <button type="button" className="offer-widget__btn" onClick={onCopy}>
                {copyLabel}
              </button>
            )}
            {actions}
          </div>
        </div>
      </div>

      {footer && <div className="offer-widget__footer">{footer}</div>}
    </div>
  );
}
