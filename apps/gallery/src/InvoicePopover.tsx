import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

import { CopyButton } from './CopyButton';

export type InvoicePopoverProps = {
  invoice: string | null;
  amountSats?: number;
  status?: 'pending' | 'paid' | 'error';
  onClose: () => void;
};

export function InvoicePopover({ invoice, amountSats, status = 'pending', onClose }: InvoicePopoverProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!invoice) return;
    QRCode.toDataURL(invoice, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      .then(setDataUrl)
      .catch((err: unknown) => console.warn('qr gen failed', err));
  }, [invoice]);

  const displayAmount = useMemo(() => (amountSats ? `${amountSats} sats` : ''), [amountSats]);
  if (!invoice) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Invoice</div>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>
        {displayAmount && <div style={{ marginBottom: '0.5rem', color: '#64748b' }}>{displayAmount}</div>}
        <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: status === 'paid' ? '#22c55e' : '#f97316' }}>
          {status === 'paid' ? 'Paid' : 'Waiting for payment'}
        </div>
        {dataUrl ? (
          <img src={dataUrl} alt="Lightning invoice QR" style={{ width: '220px', height: '220px', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.12)', marginBottom: '0.75rem' }} />
        ) : (
          <div style={{ height: 220, width: 220, display: 'grid', placeItems: 'center', marginBottom: '0.75rem' }}>Generating…</div>
        )}
        <div style={invoiceBox}>
          <code style={{ wordBreak: 'break-all', fontSize: '0.82rem' }}>{invoice}</code>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <CopyButton text={invoice} label="Copy" size="md" />
          <a href={`lightning:${invoice}`} style={walletLink}>Open in wallet</a>
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
  width: 320,
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  animation: 'popIn 140ms ease-out'
};

const invoiceBox: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '0.6rem',
  maxHeight: 110,
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
