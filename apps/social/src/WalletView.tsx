import { Alert, useToast } from '@nostrstack/ui';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WithdrawRequest = {
  k1: string;
  lnurl: string;
  requestUrl: string;
  expiresAt: string;
};

type WithdrawStatus = 'idle' | 'loading' | 'ready' | 'paid' | 'error' | 'expired' | 'disabled';

type WalletViewProps = {
  open: boolean;
  onClose: () => void;
  balanceSats?: number;
  apiBase: string;
  apiConfigured: boolean;
  withdrawEnabled: boolean;
};

const POLL_INTERVAL_MS = 2500;

export function WalletView({
  open,
  onClose,
  balanceSats,
  apiBase,
  apiConfigured,
  withdrawEnabled
}: WalletViewProps) {
  const toast = useToast();
  const [request, setRequest] = useState<WithdrawRequest | null>(null);
  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const maxWithdrawMsat = useMemo(
    () => Math.max(0, Math.floor((balanceSats ?? 0) * 1000)),
    [balanceSats]
  );
  const canWithdraw = withdrawEnabled && apiConfigured && maxWithdrawMsat >= 1000;

  const reset = useCallback(() => {
    setRequest(null);
    setStatus('idle');
    setError(null);
    setQr(null);
    setCopyState('idle');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Focus management
  useEffect(() => {
    if (!open) return;

    // Store trigger element
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus first button when modal opens
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }

    // Return focus on close
    return () => {
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  const fetchWithdraw = useCallback(async () => {
    if (!open) return;
    if (!withdrawEnabled) {
      setStatus('disabled');
      setError('Withdrawals are disabled.');
      return;
    }
    if (!apiConfigured) {
      setStatus('error');
      setError('Withdrawals unavailable (API base not configured).');
      return;
    }
    if (maxWithdrawMsat < 1000) {
      setStatus('error');
      setError('Insufficient balance to withdraw.');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/lnurl-withdraw/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minWithdrawable: 1000,
          maxWithdrawable: maxWithdrawMsat,
          defaultDescription: 'nostrstack withdraw'
        })
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WithdrawRequest;
      setRequest(data);
      setStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start withdrawal.';
      setStatus('error');
      setError(message);
    }
  }, [apiBase, apiConfigured, maxWithdrawMsat, open, withdrawEnabled]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    fetchWithdraw();
  }, [fetchWithdraw, open, reset]);

  useEffect(() => {
    if (!request?.lnurl) {
      setQr(null);
      return;
    }
    let active = true;
    const payload = request.lnurl.startsWith('lnurl')
      ? `lightning:${request.lnurl}`
      : request.lnurl;
    QRCode.toDataURL(payload, { width: 220, margin: 1 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [request?.lnurl]);

  useEffect(() => {
    if (!open || !request || status !== 'ready') return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`${apiBase}/api/lnurl-withdraw/status/${request.k1}`);
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        const state = String(data.status ?? '').toUpperCase();
        if (state === 'PAID') {
          setStatus('paid');
          toast({ message: 'Withdrawal confirmed.', tone: 'success' });
          return;
        }
        if (state === 'FAILED') {
          setStatus('error');
          setError('Withdrawal failed.');
          toast({ message: 'Withdrawal failed.', tone: 'danger' });
          return;
        }
        if (state === 'EXPIRED') {
          setStatus('expired');
          setError('Withdrawal request expired.');
          return;
        }
      } catch {
        // ignore transient failures
      }
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiBase, open, request, status, toast]);

  const handleCopy = useCallback(async () => {
    if (!request?.lnurl) return;
    try {
      await navigator.clipboard.writeText(request.lnurl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 1500);
  }, [request?.lnurl]);

  const handleOpenWallet = useCallback(() => {
    if (!request?.lnurl) return;
    window.location.href = `lightning:${request.lnurl}`;
  }, [request?.lnurl]);

  if (!open) return null;

  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Modal overlay/content click patterns */
  return (
    <div
      className="ns-dialog-overlay"
      role="button"
      tabIndex={0}
      aria-label="Close withdraw dialog"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        handleClose();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="ns-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        aria-describedby="withdraw-subtitle"
      >
        <div className="ns-dialog__header">
          <div>
            <div id="withdraw-title" className="ns-dialog__title">
              Withdraw Funds
            </div>
            <div id="withdraw-subtitle" className="ns-dialog__subtitle">
              Send sats to your Lightning wallet via LNURL-withdraw.
            </div>
          </div>
          <button
            className="ns-dialog__close"
            onClick={handleClose}
            aria-label="Close withdraw dialog"
          >
            ×
          </button>
        </div>

        <div className="ns-dialog__body">
          {status !== 'idle' && (
            <Alert
              tone={
                status === 'error' || status === 'expired'
                  ? 'danger'
                  : status === 'paid'
                    ? 'success'
                    : 'info'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                justifyContent: 'center'
              }}
              role="status"
              aria-live="polite"
              className="withdraw-status"
            >
              {status === 'loading' && (
                <>
                  <span className="ns-spinner" aria-hidden="true" />
                  Preparing withdraw request...
                </>
              )}
              {status === 'ready' && 'Scan QR or open your wallet to claim.'}
              {status === 'paid' && 'Withdrawal confirmed.'}
              {status === 'expired' && 'Withdraw request expired.'}
              {status === 'disabled' && 'Withdrawals are disabled.'}
              {status === 'error' && (error ?? 'Unable to start withdrawal.')}
            </Alert>
          )}

          {request && status !== 'loading' && (
            <div className="ns-dialog__grid">
              <div className="ns-dialog__qr withdraw-qr">
                {qr ? (
                  <img src={qr} alt="LNURL withdraw QR code" />
                ) : (
                  <div className="withdraw-qr-fallback">LNURL</div>
                )}
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div
                  style={{ fontSize: '1rem', fontWeight: 600 }}
                  role="status"
                  aria-label={`${balanceSats?.toLocaleString() ?? 0} sats available to withdraw`}
                >
                  {balanceSats?.toLocaleString() ?? 0} sats available
                </div>
                {(balanceSats ?? 0) === 0 && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--ns-color-warning)',
                      fontStyle: 'italic'
                    }}
                  >
                    Stack some sats first to withdraw them!
                  </div>
                )}

                <div
                  style={{
                    fontFamily: 'var(--ns-font-mono)',
                    fontSize: '0.8rem',
                    wordBreak: 'break-all',
                    padding: '0.75rem',
                    background: 'var(--ns-color-bg-subtle)',
                    borderRadius: 'var(--ns-radius-md)',
                    border: '1px solid var(--ns-color-border-default)'
                  }}
                >
                  {request.lnurl}
                </div>

                <div
                  style={{ display: 'flex', gap: '0.5rem' }}
                  role="group"
                  aria-label="Withdrawal actions"
                >
                  <button
                    className="ns-btn ns-btn--sm"
                    onClick={handleCopy}
                    disabled={!canWithdraw}
                    aria-label="Copy LNURL to clipboard"
                  >
                    {copyState === 'copied' ? 'COPIED' : 'COPY LNURL'}
                  </button>
                  <button
                    className="ns-btn ns-btn--primary ns-btn--sm"
                    onClick={handleOpenWallet}
                    disabled={!canWithdraw}
                    aria-label="Open Lightning wallet"
                  >
                    OPEN WALLET
                  </button>
                </div>
                {copyState === 'error' && (
                  <div
                    style={{ fontSize: '0.75rem', color: 'var(--ns-color-danger)' }}
                    role="alert"
                  >
                    Clipboard unavailable.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
