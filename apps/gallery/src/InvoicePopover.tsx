import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [dataUrl, setDataUrl] = useState<string>('');
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
    QRCode.toDataURL(invoice, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      .then(setDataUrl)
      .catch((err: unknown) => console.warn('qr gen failed', err));
  }, [invoice]);

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

  const copyInvoice = async () => {
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('Clipboard not available');
      await navigator.clipboard.writeText(invoice);
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
        className="nostrstack-popover"
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

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <div
            className="nostrstack-popover-grid"
          >
            <div
              className="nostrstack-qr"
            >
              <button
                type="button"
                onClick={copyInvoice}
                aria-label="Copy invoice"
                className="nostrstack-invoice-qr"
                style={{
                  width: '100%',
                  border: 'none',
                  padding: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 'var(--nostrstack-radius-md)'
                }}
              >
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt="Lightning invoice QR"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxWidth: 240,
                      maxHeight: 240,
                      display: 'block',
                      margin: '0 auto',
                      borderRadius: 'var(--nostrstack-radius-md)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 240,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--nostrstack-color-text-subtle)'
                    }}
                  >
                    Generating…
                  </div>
                )}
              </button>
              <div
                id={descId}
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  color: 'var(--nostrstack-color-text-muted)'
                }}
              >
                Scan to pay • Click QR to copy
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
              <div style={statusVizWrapper}>
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
                      <span style={{ fontWeight: 800, textAlign: 'center' }}>{statusLabel}</span>
                      <span
                        style={{ fontSize: '0.75rem', color: 'var(--nostrstack-color-text-muted)' }}
                      >
                        {fmtRemaining} left
                      </span>
                      {visualState === 'pending' && <div style={ringHalo} />}
                    </div>
                  </div>
                  {celebrate && <div key={burstKey} style={burst} aria-hidden />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div
                    style={{ fontWeight: 800, color: 'var(--nostrstack-color-text)' }}
                    aria-live="polite"
                  >
                    {statusLabel}
                  </div>
                  <div
                    style={{
                      color: 'var(--nostrstack-color-text-muted)',
                      fontSize: '0.95rem',
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap'
                    }}
                  >
                    <span>Elapsed {fmtAge}</span>
                    {!stale && <span>• Expires {fmtRemaining}</span>}
                    {visualState === 'timeout' && <span>• Expired</span>}
                  </div>
                  <div style={beamWrap} aria-label="Time remaining">
                    <div style={{ ...beamTrack }}>
                      <div
                        style={{
                          ...beamFill,
                          width: `${(1 - progress) * 100}%`,
                          background:
                            visualState === 'paid'
                              ? 'var(--nostrstack-color-success)'
                              : visualState === 'timeout' || visualState === 'error'
                                ? 'var(--nostrstack-color-danger)'
                                : 'var(--nostrstack-color-primary)'
                        }}
                      />
                    </div>
                    <div
                      style={{
                        ...beam,
                        backgroundImage:
                          visualState === 'paid'
                            ? 'linear-gradient(90deg, var(--nostrstack-color-success), var(--nostrstack-color-primary))'
                            : 'linear-gradient(90deg, var(--nostrstack-color-primary), var(--nostrstack-color-accent))',
                        animation:
                          visualState === 'paid'
                            ? 'beam-slide 1s ease-out 1'
                            : visualState === 'timeout' || visualState === 'error'
                              ? 'none'
                              : 'beam-slide 1.2s linear infinite'
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="nostrstack-popover-actions">
                <a
                  href={`lightning:${invoice}`}
                  className="nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm"
                  style={{ textDecoration: 'none' }}
                >
                  Open in wallet
                </a>
                {stale && (
                  <button type="button" onClick={onClose} className="nostrstack-btn nostrstack-btn--sm">
                    Dismiss
                  </button>
                )}
              </div>
              {visualState === 'paid' && (
                <div
                  style={{
                    color: 'var(--nostrstack-color-success)',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}
                >
                  Payment confirmed
                </div>
              )}
              {visualState === 'error' && (
                <div
                  style={{
                    color: 'var(--nostrstack-color-danger)',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}
                >
                  Payment failed
                </div>
              )}
              {visualState === 'timeout' && (
                <div
                  style={{
                    color: 'var(--nostrstack-color-danger)',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}
                >
                  Invoice expired, request a new one.
                </div>
              )}
            </div>
          </div>

          <div className="nostrstack-invoice-box">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--nostrstack-color-text)' }}>BOLT11</div>
              <CopyButton text={invoice} label="Copy" size="sm" />
            </div>
            <code className="nostrstack-code">{invoice}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const statusVizWrapper: React.CSSProperties = {
  border: '1px solid var(--nostrstack-color-border)',
  borderRadius: 'var(--nostrstack-radius-lg)',
  padding: '0.75rem 0.85rem',
  background: 'var(--nostrstack-color-surface-subtle)',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.85rem',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden'
};

const ringShell: React.CSSProperties = {
  position: 'relative',
  width: 86,
  height: 86,
  display: 'grid',
  placeItems: 'center'
};
const ring: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  transition: 'all 220ms ease'
};
const ringInner: React.CSSProperties = {
  width: 52,
  height: 52,
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

const beamWrap: React.CSSProperties = {
  width: '100%',
  height: 12,
  borderRadius: 999,
  background: 'var(--nostrstack-color-surface-strong)',
  overflow: 'hidden',
  position: 'relative'
};
const beam: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(90deg, var(--nostrstack-color-primary), var(--nostrstack-color-accent))',
  backgroundSize: '200% 100%',
  opacity: 0.35,
  animation: 'beam-slide 2s linear infinite'
};
const beamTrack: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: 'transparent'
};
const beamFill: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 999,
  transition: 'width 300ms ease',
  background: 'var(--nostrstack-color-primary)'
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

  @keyframes beam-slide {
    0% { transform: translateX(-40%); }
    100% { transform: translateX(40%); }
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
