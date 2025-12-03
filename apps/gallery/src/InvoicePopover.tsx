import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

import { CopyButton } from './CopyButton';

export type InvoicePopoverProps = {
  invoice: string | null;
  amountSats?: number;
  status?: 'pending' | 'paid' | 'error';
  onClose: () => void;
};

export function InvoicePopover({ invoice, amountSats, status = 'pending', onClose }: InvoicePopoverProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [ageMs, setAgeMs] = useState(0);

  const fmtAge = useMemo(() => {
    const secs = Math.max(0, Math.floor(ageMs / 1000));
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
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

  const stale = status === 'pending' && ageMs > 120000;
  const displayAmount = useMemo(() => (amountSats ? `${amountSats} sats` : ''), [amountSats]);
  const visualState = stale ? 'timeout' : status;
  const tone =
    visualState === 'paid'
      ? { bg: '#ecfdf3', fg: '#15803d', border: '#bbf7d0', pulse: '0 0 0 0 rgba(21,128,61,0.35)', icon: 'check', glow: '0 12px 30px rgba(34,197,94,0.25)' }
      : visualState === 'error' || visualState === 'timeout'
        ? { bg: '#fef2f2', fg: '#b91c1c', border: '#fecdd3', pulse: 'none', icon: 'x', glow: '0 10px 26px rgba(185,28,28,0.22)' }
        : { bg: '#f0fdf4', fg: '#16a34a', border: '#bbf7d0', pulse: '0 0 0 0 rgba(22,163,74,0.35)', icon: 'dot', glow: '0 12px 32px rgba(22,163,74,0.18)' };

  const statusLabel =
    visualState === 'paid'
      ? 'Paid'
      : visualState === 'error'
        ? 'Payment error'
        : visualState === 'timeout'
          ? 'Timed out'
          : 'Waiting for payment';
  if (!invoice) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <style>{pulseCss}</style>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Invoice</div>
            {displayAmount && <div style={{ color: '#475569', fontWeight: 700 }}>{displayAmount}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.4rem 0.9rem',
                borderRadius: 999,
                background: tone.bg,
                color: tone.fg,
                border: `1px solid ${tone.border}`,
                fontWeight: 800,
                boxShadow: visualState === 'pending' || visualState === 'paid' ? tone.glow : 'none',
                transition: 'all 180ms ease'
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: tone.fg,
                  boxShadow: status === 'pending' && !stale ? tone.pulse : 'none',
                  animation:
                    status === 'pending' && !stale
                      ? 'invoice-pulse 1.4s infinite'
                      : visualState === 'paid' || visualState === 'error' || visualState === 'timeout'
                        ? 'status-pop 240ms ease-out'
                        : 'none',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 900
                }}
              >
                {tone.icon === 'check' ? '✓' : tone.icon === 'x' ? '×' : ''}
              </span>
              {statusLabel}
            </span>
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close invoice">×</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 260px) 1fr', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 28px rgba(15,23,42,0.08)' }}>
              {dataUrl ? (
                <img src={dataUrl} alt="Lightning invoice QR" style={{ width: '100%', height: '100%', maxWidth: 240, maxHeight: 240, display: 'block', margin: '0 auto', borderRadius: 10 }} />
              ) : (
                <div style={{ height: 240, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>Generating…</div>
              )}
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.9rem', color: '#475569' }}>
                Scan or tap to pay
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: '0.95rem' }}>
                <span style={{ fontWeight: 700 }}>Elapsed:</span> <time>{fmtAge}</time>
              </div>
              <CopyButton text={invoice} label="Copy BOLT11" size="md" />
              <a href={`lightning:${invoice}`} style={walletLink}>Open in wallet</a>
              {stale && (
                <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600 }}>
                  Dismiss
                </button>
              )}
              {visualState === 'paid' && <div style={{ color: '#15803d', fontWeight: 700, fontSize: '0.95rem' }}>Payment confirmed</div>}
              {visualState === 'error' && <div style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.95rem' }}>Payment failed</div>}
              {visualState === 'timeout' && <div style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.95rem' }}>Invoice expired, request a new one.</div>}
            </div>
          </div>

          <div style={invoiceBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>BOLT11</div>
              <CopyButton text={invoice} label="Copy" size="sm" />
            </div>
            <code style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{invoice}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  animation: 'fadeIn 120ms ease-out'
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  color: '#0f172a',
  borderRadius: 16,
  padding: '1.15rem 1.35rem',
  width: 560,
  maxWidth: '92vw',
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  animation: 'popIn 140ms ease-out'
};

const invoiceBox: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '0.75rem',
  maxHeight: 140,
  overflow: 'auto'
};

const closeBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '1.2rem',
  cursor: 'pointer'
};

const walletLink: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  borderRadius: 10,
  background: '#0ea5e9',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 600
};

const pulseCss = `
  @keyframes invoice-pulse {
    0% { box-shadow: 0 0 0 0 rgba(22,163,74,0.45); }
    70% { box-shadow: 0 0 0 14px rgba(22,163,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
  }

  @keyframes status-pop {
    0% { transform: scale(0.6); opacity: 0.4; }
    70% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
