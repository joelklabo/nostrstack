import './styles/withdraw.css';

import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from './ui/toast';

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

export function WalletView({ open, onClose, balanceSats, apiBase, apiConfigured, withdrawEnabled }: WalletViewProps) {
  const toast = useToast();
  const [request, setRequest] = useState<WithdrawRequest | null>(null);
  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const maxWithdrawMsat = useMemo(() => Math.max(0, Math.floor((balanceSats ?? 0) * 1000)), [balanceSats]);
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
    const payload = request.lnurl.startsWith('lnurl') ? `lightning:${request.lnurl}` : request.lnurl;
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

  return (
    <div className="withdraw-overlay" role="presentation" onClick={handleClose}>
      <div className="withdraw-modal" onClick={(event) => event.stopPropagation()}>
        <div className="withdraw-header">
          <div>
            <div className="withdraw-title">Withdraw Funds</div>
            <div className="withdraw-subtitle">Send sats to your Lightning wallet via LNURL-withdraw.</div>
          </div>
          <button className="withdraw-close" onClick={handleClose} aria-label="Close withdraw dialog">×</button>
        </div>

        <div className="withdraw-body">
          <div className={`withdraw-status ${status === 'error' ? 'is-error' : status === 'paid' ? 'is-success' : ''}`}>
            {status === 'loading' && 'Preparing withdraw request...'}
            {status === 'ready' && 'Scan QR or open your wallet to claim.'}
            {status === 'paid' && 'Withdrawal confirmed.'}
            {status === 'expired' && 'Withdraw request expired.'}
            {status === 'disabled' && 'Withdrawals are disabled.'}
            {status === 'error' && (error ?? 'Unable to start withdrawal.')}
          </div>

          {request && status !== 'loading' && (
            <div className="withdraw-grid">
              <div className="withdraw-qr">
                {qr ? <img src={qr} alt="LNURL withdraw QR" /> : <div className="withdraw-qr-fallback">LNURL</div>}
              </div>
              <div className="withdraw-details">
                <div className="withdraw-amount">
                  {balanceSats?.toLocaleString() ?? 0} sats available
                </div>
                <code className="withdraw-lnurl">{request.lnurl}</code>
                <div className="withdraw-actions">
                  <button className="action-btn" onClick={handleCopy} disabled={!canWithdraw}>
                    {copyState === 'copied' ? 'COPIED' : 'COPY_LNURL'}
                  </button>
                  <button className="action-btn" onClick={handleOpenWallet} disabled={!canWithdraw}>
                    OPEN_WALLET
                  </button>
                </div>
                {copyState === 'error' && <div className="withdraw-hint">Clipboard unavailable.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
