import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useId, useRef } from 'react';

export type PaymentStatusTone = 'neutral' | 'success' | 'error';

export type PaymentStatusItem = {
  text: string;
  tone?: PaymentStatusTone;
  spinner?: boolean;
};

export type PaymentSuccessAction = {
  title: string;
  body?: string;
  url?: string;
  label?: string;
};

export type PaymentInvoice = {
  value: string;
  copyStatus: 'idle' | 'copied' | 'error';
  regtestAvailable?: boolean;
  regtestPaying?: boolean;
  onCopy: () => void;
  onOpenWallet: () => void;
  onRegtestPay?: () => void;
};

export type PaymentModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  statusItems: PaymentStatusItem[];
  invoice?: PaymentInvoice | null;
  success?: boolean;
  successMessage?: string;
  successAction?: PaymentSuccessAction | null;
  error?: boolean;
  disclaimer?: string;
  onClose: () => void;
  titleId?: string;
  statusId?: string;
};

export function PaymentModal({
  open,
  title,
  subtitle,
  statusItems,
  invoice,
  success,
  successMessage,
  successAction,
  error,
  disclaimer,
  onClose,
  titleId,
  statusId
}: PaymentModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const resolvedTitleId = titleId ?? useId();
  const resolvedStatusId = statusId ?? useId();
  const visibleStatuses = statusItems.filter((item) => item && item.text);
  const showInvoice = Boolean(invoice?.value);
  const showSuccess = Boolean(success);
  const showErrorActions = Boolean(error) && !showInvoice && !showSuccess;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable ?? modal).focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || active === modal) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [open, onClose]);

  if (!open) return null;

  const copyLabel = invoice
    ? invoice.copyStatus === 'copied'
      ? 'COPIED'
      : invoice.copyStatus === 'error'
        ? 'COPY_FAILED'
        : 'COPY_INVOICE'
    : 'COPY_INVOICE';

  return (
    <div className="payment-overlay" onClick={onClose} role="presentation">
      <div
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedStatusId}
        tabIndex={-1}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="payment-header">
          <div>
            <div className="payment-title" id={resolvedTitleId}>
              {title}
            </div>
            {subtitle && <div className="payment-subtitle">{subtitle}</div>}
          </div>
          <button className="payment-close" type="button" aria-label="Close payment dialog" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="payment-body">
          {visibleStatuses.map((item, index) => (
            <div
              key={`${item.text}-${index}`}
              className={`payment-status ${
                item.tone === 'success'
                  ? 'payment-status--success'
                  : item.tone === 'error'
                    ? 'payment-status--error'
                    : ''
              }`}
              id={index === 0 ? resolvedStatusId : undefined}
              aria-live={index === 0 ? 'polite' : undefined}
            >
              {item.spinner && <span className="payment-spinner" aria-hidden="true" />}
              <span>{item.text}</span>
            </div>
          ))}

          {disclaimer && <div className="payment-disclaimer">{disclaimer}</div>}

          {showInvoice && invoice && (
            <div className="payment-grid">
              <div className="payment-qr" role="img" aria-label="Payment invoice QR code">
                <QRCodeSVG value={invoice.value} size={240} bgColor="#ffffff" fgColor="#0f172a" level="L" />
              </div>
              <div className="payment-panel">
                <div className="payment-panel-header">
                  <div className="payment-panel-title">INVOICE</div>
                  {invoice.regtestAvailable && <div className="payment-panel-badge" role="status">REGTEST</div>}
                </div>
                <div className="payment-invoice-box" role="region" aria-label="Lightning invoice">
                  <code>{invoice.value}</code>
                </div>
                <div className="payment-actions" role="group" aria-label="Payment actions">
                  <button 
                    className="payment-action" 
                    type="button" 
                    onClick={invoice.onCopy} 
                    disabled={!invoice.value}
                    aria-label={invoice.copyStatus === 'copied' ? 'Invoice copied to clipboard' : invoice.copyStatus === 'error' ? 'Failed to copy invoice' : 'Copy invoice to clipboard'}
                  >
                    {copyLabel}
                  </button>
                  <button 
                    className="payment-action payment-action-primary" 
                    type="button" 
                    onClick={invoice.onOpenWallet}
                    aria-label="Open Lightning wallet to pay invoice"
                  >
                    OPEN_WALLET
                  </button>
                  {invoice.regtestAvailable && invoice.onRegtestPay && (
                    <button
                      className="payment-action payment-action-warning"
                      type="button"
                      onClick={invoice.onRegtestPay}
                      disabled={invoice.regtestPaying}
                      aria-label={invoice.regtestPaying ? 'Paying invoice with regtest funds' : 'Pay invoice with regtest funds'}
                      aria-busy={invoice.regtestPaying}
                    >
                      {invoice.regtestPaying ? 'PAYING_REGTEST...' : 'PAY_REGTEST'}
                    </button>
                  )}
                  <button className="payment-action" type="button" onClick={onClose} aria-label="Close payment dialog">
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="payment-success" role="status" aria-live="polite">
              <div className="payment-success-icon" aria-hidden="true">✓</div>
              <div>{successMessage ?? 'Payment sent.'}</div>
              {successAction && (
                <div className="payment-success-action">
                  <div className="payment-success-action-title">{successAction.title}</div>
                  {successAction.url ? (
                    <a 
                      href={successAction.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      aria-label={`Open link: ${successAction.label}`}
                    >
                      {successAction.label}
                    </a>
                  ) : (
                    <div>{successAction.body}</div>
                  )}
                </div>
              )}
              <button 
                className="payment-action payment-action-primary" 
                type="button" 
                onClick={onClose}
                aria-label="Close payment dialog"
              >
                CLOSE
              </button>
            </div>
          )}

          {showErrorActions && (
            <div className="payment-actions" role="group" aria-label="Error actions">
              <button 
                className="payment-action" 
                type="button" 
                onClick={onClose}
                aria-label="Close payment dialog"
              >
                CLOSE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
