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
  const [celebrate, setCelebrate] = useState(false);

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
  const progress = Math.min(1, ageMs / 120000);
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

  useEffect(() => {
    if (visualState === 'paid') {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [visualState]);

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220 }}>
                <div style={statusVizWrapper}>
                <div style={ringShell}>
                  <div
                    style={{
                      ...ring,
                      background: `conic-gradient(${tone.fg} ${Math.max(10, progress * 360)}deg, #e2e8f0 ${Math.max(10, progress * 360)}deg)`,
                      boxShadow: visualState === 'pending' ? '0 0 0 10px rgba(14,165,233,0.12)' : visualState === 'paid' ? '0 0 0 12px rgba(34,197,94,0.18)' : 'none',
                      animation: visualState === 'pending' ? 'ring-spin 2.4s linear infinite' : undefined
                    }}
                    aria-hidden
                  >
                    <div style={{ ...ringInner, color: tone.fg }}>
                      <span style={{ fontWeight: 800 }}>{statusLabel}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>{fmtAge}</span>
                    </div>
                  </div>
                  {celebrate && <div style={burst} aria-hidden />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }} aria-live="polite">
                    {statusLabel}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.95rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>Elapsed {fmtAge}</span>
                    {!stale && <span>• Expires 02:00</span>}
                    {visualState === 'timeout' && <span>• Expired</span>}
                  </div>
                  <div style={beamWrap} aria-label="Time remaining">
                    <div style={{ ...beamTrack }}>
                      <div
                        style={{
                          ...beamFill,
                          width: `${(1 - progress) * 100}%`,
                          background: visualState === 'paid' ? '#22c55e' : visualState === 'timeout' ? '#ef4444' : '#0ea5e9'
                        }}
                      />
                    </div>
                    <div
                      style={{
                        ...beam,
                        background: visualState === 'paid' ? 'linear-gradient(90deg, #22c55e, #0ea5e9)' : 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                        animation: visualState === 'paid' ? 'beam-slide 1s ease-out 1' : 'beam-slide 1.2s linear infinite'
                      }}
                    />
                  </div>
                </div>
              </div>
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

const statusVizWrapper: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: '0.75rem 0.85rem',
  background: '#f8fafc',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.85rem',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden'
};

const ringShell: React.CSSProperties = { position: 'relative', width: 86, height: 86, display: 'grid', placeItems: 'center' };
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
  background: '#fff',
  display: 'grid',
  placeItems: 'center',
  padding: '0.4rem',
  textAlign: 'center',
  fontSize: '0.82rem',
  fontWeight: 800,
  border: '1px solid #e2e8f0',
  boxShadow: '0 6px 18px rgba(15,23,42,0.08)'
};

const beamWrap: React.CSSProperties = { width: '100%', height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', position: 'relative' };
const beam: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
  backgroundSize: '200% 100%',
  opacity: 0.35,
  animation: 'beam-slide 2s linear infinite'
};
const beamTrack: React.CSSProperties = { position: 'relative', width: '100%', height: '100%', background: 'transparent' };
const beamFill: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 999,
  transition: 'width 300ms ease',
  background: '#0ea5e9'
};

const burst: React.CSSProperties = {
  position: 'absolute',
  inset: -6,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0) 60%)',
  animation: 'burst 650ms ease-out'
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

  @keyframes beam-slide {
    0% { transform: translateX(-40%); }
    100% { transform: translateX(40%); }
  }

  @keyframes burst {
    0% { transform: scale(0.6); opacity: 0.55; }
    70% { transform: scale(1.1); opacity: 0.35; }
    100% { transform: scale(1.25); opacity: 0; }
  }

  @keyframes ring-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
