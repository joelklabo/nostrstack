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
  const tone =
    status === 'paid'
      ? { bg: '#ecfdf3', fg: '#166534', border: '#bbf7d0' }
      : status === 'error'
        ? { bg: '#fef2f2', fg: '#b91c1c', border: '#fecdd3' }
        : stale
          ? { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' }
          : { bg: '#f8fafc', fg: '#0f172a', border: '#e2e8f0' };
  if (!invoice) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <style>{pulseCss}</style>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Invoice</div>
            {displayAmount && <div style={{ color: '#64748b', fontWeight: 600 }}>{displayAmount}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.3rem 0.65rem',
                borderRadius: 999,
                background: tone.bg,
                color: tone.fg,
                border: `1px solid ${tone.border}`,
                fontWeight: 700
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: tone.fg,
                  boxShadow: status === 'pending' && !stale ? '0 0 0 0 rgba(14,165,233,0.35)' : 'none',
                  animation: status === 'pending' && !stale ? 'invoice-pulse 1.5s infinite' : 'none'
                }}
              />
              {status === 'paid' ? 'Paid' : status === 'error' ? 'Payment error' : stale ? 'Timed out' : 'Waiting for payment'}
            </span>
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close invoice">×</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {dataUrl ? (
              <img src={dataUrl} alt="Lightning invoice QR" style={{ width: '220px', height: '220px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }} />
            ) : (
              <div style={{ height: 220, width: 220, display: 'grid', placeItems: 'center' }}>Generating…</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
              <div style={{ color: '#475569', fontSize: '0.95rem' }}>Elapsed: {fmtAge}</div>
              <CopyButton text={invoice} label="Copy BOLT11" size="md" />
              <a href={`lightning:${invoice}`} style={walletLink}>Open in wallet</a>
              {stale && (
                <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.75rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff' }}>
                  Dismiss
                </button>
              )}
            </div>
          </div>

          <div style={invoiceBox}>
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
  padding: '1rem 1.2rem',
  width: 360,
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
    0% { box-shadow: 0 0 0 0 rgba(14,165,233,0.45); }
    70% { box-shadow: 0 0 0 10px rgba(14,165,233,0); }
    100% { box-shadow: 0 0 0 0 rgba(14,165,233,0); }
  }
`;
