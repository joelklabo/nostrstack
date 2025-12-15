import { useEffect, useMemo, useRef, useState } from 'react';

import { BrandedQr } from './BrandedQr';
import { copyToClipboard } from './clipboard';
import { CopyButton } from './CopyButton';
import { useToast } from './toast';

export type InvoicePopoverProps = {
  invoice: string | null;
  amountSats?: number;
  status?: 'pending' | 'paid' | 'error';
  onClose: () => void;
};

export function InvoicePopover({
  invoice,
  amountSats,
  status = 'pending',
  onClose
}: InvoicePopoverProps) {
  const toast = useToast();
  const [ageMs, setAgeMs] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const fmtAge = useMemo(() => {
    const secs = Math.max(0, Math.floor(ageMs / 1000));
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [ageMs]);
  const fmtRemaining = useMemo(() => {
    const rem = Math.max(0, 120 - Math.floor(ageMs / 1000));
    const m = Math.floor(rem / 60)
      .toString()
      .padStart(2, '0');
    const s = (rem % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [ageMs]);

  useEffect(() => {
    if (!invoice) return;
    const started = Date.now();
    const id = setInterval(() => setAgeMs(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, [invoice]);

  useEffect(() => {
    if (invoice) {
      // focus dialog for accessibility
      closeBtnRef.current?.focus();
      cardRef.current?.focus();
    }
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invoice, onClose]);

  const stale = status === 'pending' && ageMs > 120000;
  const progress = Math.min(1, ageMs / 120000);
  const displayAmount = useMemo(() => (amountSats ? `${amountSats} sats` : ''), [amountSats]);
  const titleId = 'nostrstack-invoice-popover-title';
  const descId = 'nostrstack-invoice-popover-desc';
  const visualState = stale ? 'timeout' : status;
  const toneFg =
    visualState === 'paid'
      ? 'var(--nostrstack-color-success)'
      : visualState === 'error' || visualState === 'timeout'
        ? 'var(--nostrstack-color-danger)'
        : 'var(--nostrstack-color-primary)';

  const statusLabel =
    visualState === 'paid'
      ? 'Paid'
      : visualState === 'error'
        ? 'Payment error'
        : visualState === 'timeout'
          ? 'Timed out'
          : 'Waiting for payment';

  useEffect(() => {
    if (visualState === 'paid') {
      setCelebrate(true);
      setBurstKey((k) => k + 1);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [visualState]);

  if (!invoice) return null;

  const prettyInvoice = (() => {
    const head = invoice.slice(0, 18);
    const tail = invoice.length > 28 ? invoice.slice(-10) : '';
    return tail ? `${head}…${tail}` : invoice;
  })();

  const copyInvoice = async () => {
    try {
      await copyToClipboard(invoice);
      toast({ message: 'Invoice copied', tone: 'success' });
    } catch (err) {
      console.warn('copy invoice failed', err);
      toast({ message: 'Copy failed', tone: 'danger' });
    }
  };

  return (
    <div className="nostrstack-popover-overlay nostrstack-gallery-popover-overlay" onClick={onClose}>
      <style>{pulseCss}</style>
      <div
        className="nostrstack-popover nostrstack-invoice-modal"
        onClick={(e) => e.stopPropagation()}
        aria-live="polite"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={cardRef}
        tabIndex={-1}
      >
        <div className="nostrstack-popover-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="nostrstack-popover-title" id={titleId}>
              Invoice
            </div>
            {displayAmount && (
              <div className="nostrstack-popover-sub">
                {displayAmount}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="nostrstack-btn nostrstack-btn--sm nostrstack-btn--ghost"
            style={{ borderRadius: 'var(--nostrstack-radius-pill)', padding: '0.25rem 0.6rem' }}
            aria-label="Close invoice"
            ref={closeBtnRef}
          >
            ×
          </button>
        </div>

        <div className="nostrstack-invoice-modal__grid">
          <div className="nostrstack-invoice-modal__qrCard">
            <button
              type="button"
              onClick={copyInvoice}
              aria-label="Copy invoice"
              className="nostrstack-invoice-modal__qrBtn"
            >
              <div className="nostrstack-invoice-modal__qrImg">
                <BrandedQr value={invoice} preset="brandLogo" verify="strict" size={320} />
              </div>
            </button>
            <div id={descId} className="nostrstack-invoice-modal__hint">
              Scan to pay · Click QR to copy
            </div>
          </div>

          <div className="nostrstack-invoice-modal__side">
            <div className="nostrstack-invoice-modal__statusCard" data-state={visualState}>
              <div style={ringShell}>
                <div
                  style={{
                    ...ring,
                    background: `conic-gradient(${toneFg} ${Math.max(14, progress * 360)}deg, var(--nostrstack-color-border) ${Math.max(14, progress * 360)}deg)`,
                    boxShadow:
                      visualState === 'pending'
                        ? '0 0 0 12px color-mix(in oklab, var(--nostrstack-color-primary) 18%, transparent)'
                        : visualState === 'paid'
                          ? '0 0 0 14px color-mix(in oklab, var(--nostrstack-color-success) 22%, transparent)'
                          : 'none',
                    animation:
                      visualState === 'pending'
                        ? 'ring-spin 1.6s linear infinite'
                        : visualState === 'paid'
                          ? 'status-pop 260ms ease-out'
                          : undefined
                  }}
                  aria-hidden
                >
                  <div style={{ ...ringInner, color: toneFg, position: 'relative' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.05rem', lineHeight: 1 }}>
                      {visualState === 'paid' ? '✓' : visualState === 'error' ? '!' : visualState === 'timeout' ? '0:00' : fmtRemaining}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--nostrstack-color-text-muted)' }}>
                      {visualState === 'paid' ? 'Paid' : visualState === 'error' ? 'Error' : visualState === 'timeout' ? 'Expired' : 'left'}
                    </span>
                    {visualState === 'pending' && <div style={ringHalo} />}
                  </div>
                </div>
                {celebrate && <div key={burstKey} style={burst} aria-hidden />}
              </div>

              <div className="nostrstack-invoice-modal__statusMeta">
                <div className="nostrstack-invoice-modal__statusTitle" aria-live="polite">
                  {statusLabel}
                </div>
                <div className="nostrstack-invoice-modal__statusSub">
                  <span>Elapsed {fmtAge}</span>
                  {!stale && <span>• Expires {fmtRemaining}</span>}
                  {visualState === 'timeout' && <span>• Expired</span>}
                </div>
                <div className="nostrstack-invoice-modal__bar" aria-label="Time remaining">
                  <div
                    className="nostrstack-invoice-modal__barFill"
                    style={{
                      width: `${Math.max(0, (1 - progress) * 100)}%`,
                      background:
                        visualState === 'paid'
                          ? 'var(--nostrstack-color-success)'
                          : visualState === 'timeout' || visualState === 'error'
                            ? 'var(--nostrstack-color-danger)'
                            : 'var(--nostrstack-color-primary)'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="nostrstack-invoice-modal__actions">
              <a
                href={`lightning:${invoice}`}
                className="nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm"
                style={{ textDecoration: 'none' }}
              >
                Open in wallet
              </a>
              <CopyButton text={invoice} label="Copy BOLT11" size="sm" />
              <CopyButton text={`lightning:${invoice}`} label="Copy URI" size="sm" />
              {stale && (
                <button type="button" onClick={onClose} className="nostrstack-btn nostrstack-btn--sm">
                  Dismiss
                </button>
              )}
            </div>

            {visualState === 'paid' && (
              <div className="nostrstack-invoice-modal__callout" data-tone="success">
                Payment confirmed
              </div>
            )}
            {visualState === 'error' && (
              <div className="nostrstack-invoice-modal__callout" data-tone="danger">
                Payment failed
              </div>
            )}
            {visualState === 'timeout' && (
              <div className="nostrstack-invoice-modal__callout" data-tone="danger">
                Invoice expired — request a new one.
              </div>
            )}

            <div className="nostrstack-invoice-modal__bolt11">
              <div className="nostrstack-invoice-modal__bolt11Head">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <strong style={{ color: 'var(--nostrstack-color-text)' }}>BOLT11</strong>
                  <span style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>
                    {prettyInvoice}
                  </span>
                </div>
                <CopyButton text={invoice} label="Copy" size="sm" />
              </div>
              <code className="nostrstack-code">{invoice}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ringShell: React.CSSProperties = {
  position: 'relative',
  width: 92,
  height: 92,
  display: 'grid',
  placeItems: 'center'
};
const ring: React.CSSProperties = {
  width: 82,
  height: 82,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  transition: 'all 220ms ease'
};
const ringInner: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: '50%',
  background: 'var(--nostrstack-color-surface)',
  display: 'grid',
  placeItems: 'center',
  padding: '0.4rem',
  textAlign: 'center',
  fontSize: '0.82rem',
  fontWeight: 800,
  border: '1px solid var(--nostrstack-color-border)',
  boxShadow: 'var(--nostrstack-shadow-sm)'
};
const ringHalo: React.CSSProperties = {
  position: 'absolute',
  inset: -8,
  borderRadius: '50%',
  border: '2px solid var(--nostrstack-color-ring)',
  animation: 'ring-breathe 2.6s ease-in-out infinite'
};

const burst: React.CSSProperties = {
  position: 'absolute',
  inset: -6,
  borderRadius: '50%',
  background:
    'radial-gradient(circle, color-mix(in oklab, var(--nostrstack-color-success) 35%, transparent) 0%, transparent 60%)',
  animation: 'burst 650ms ease-out'
};

const pulseCss = `
  @keyframes status-pop {
    0% { transform: scale(0.6); opacity: 0.4; }
    70% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes ring-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes burst {
    0% { transform: scale(0.6); opacity: 0.55; }
    70% { transform: scale(1.1); opacity: 0.35; }
    100% { transform: scale(1.25); opacity: 0; }
  }

  @keyframes ring-breathe {
    0% { transform: scale(0.98); }
    50% { transform: scale(1.02); }
    100% { transform: scale(0.98); }
  }
`;
