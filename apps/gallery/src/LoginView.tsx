import './styles/lnurl-auth.css';

import { resolveApiBase, useAuth, useNostrstackConfig } from '@nostrstack/blog-kit';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

type LnurlAuthRequest = {
  k1: string;
  callback: string;
  lnurl: string;
  expiresAt: string;
};

type LnurlAuthStatus = 'idle' | 'loading' | 'polling' | 'verified' | 'expired' | 'timeout' | 'error';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

export function LoginView() {
  const { loginWithNip07, loginWithNsec, loginWithLnurl, error } = useAuth();
  const cfg = useNostrstackConfig();
  const [nsec, setNsec] = useState('');
  const [mode, setMode] = useState<'menu' | 'nsec'>('menu');
  const [lnurlModalOpen, setLnurlModalOpen] = useState(false);
  const [lnurlRequest, setLnurlRequest] = useState<LnurlAuthRequest | null>(null);
  const [lnurlStatus, setLnurlStatus] = useState<LnurlAuthStatus>('idle');
  const [lnurlError, setLnurlError] = useState<string | null>(null);
  const [lnurlQr, setLnurlQr] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const apiBaseRaw = cfg.apiBase ?? cfg.baseUrl ?? '';
  const apiBaseConfig = useMemo(
    () => cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw),
    [cfg.apiBaseConfig, apiBaseRaw]
  );
  const apiBase = useMemo(() => {
    if (apiBaseConfig.isRelative) return '';
    if (typeof window === 'undefined') return apiBaseConfig.baseUrl;
    if (window.location.protocol === 'https:' && apiBaseConfig.baseUrl.startsWith('http://')) {
      return apiBaseConfig.baseUrl.replace(/^http:/i, 'https:');
    }
    return apiBaseConfig.baseUrl;
  }, [apiBaseConfig.baseUrl, apiBaseConfig.isRelative]);

  const openLnurlModal = useCallback(async () => {
    setLnurlModalOpen(true);
    setLnurlRequest(null);
    setLnurlQr(null);
    setLnurlError(null);
    setCopyStatus('idle');
    setLnurlStatus('loading');

    if (!apiBaseConfig.isConfigured) {
      setLnurlStatus('error');
      setLnurlError('Lightning login unavailable (API base not configured).');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/api/lnurl-auth/request`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Lightning login is disabled on this server.');
        }
        throw new Error('Unable to start Lightning login.');
      }
      const data = (await response.json()) as LnurlAuthRequest;
      if (!data?.k1 || !data?.lnurl) {
        throw new Error('Invalid Lightning login response.');
      }
      setLnurlRequest(data);
      setLnurlStatus('polling');
    } catch (err: unknown) {
      setLnurlStatus('error');
      setLnurlError(err instanceof Error ? err.message : 'Lightning login failed.');
    }
  }, [apiBase, apiBaseConfig.isConfigured]);

  const closeLnurlModal = useCallback(() => {
    setLnurlModalOpen(false);
    setLnurlRequest(null);
    setLnurlStatus('idle');
    setLnurlError(null);
    setLnurlQr(null);
    setCopyStatus('idle');
  }, []);

  const handleCopyLnurl = useCallback(async () => {
    if (!lnurlRequest?.lnurl) return;
    try {
      await navigator.clipboard.writeText(lnurlRequest.lnurl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1500);
  }, [lnurlRequest]);

  const handleOpenWallet = useCallback(() => {
    if (!lnurlRequest?.lnurl) return;
    window.location.href = `lightning:${lnurlRequest.lnurl}`;
  }, [lnurlRequest]);

  useEffect(() => {
    if (!lnurlRequest?.lnurl) {
      setLnurlQr(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(lnurlRequest.lnurl, { width: 220, margin: 1 })
      .then((url) => {
        if (active) setLnurlQr(url);
      })
      .catch(() => {
        if (active) setLnurlQr(null);
      });
    return () => {
      active = false;
    };
  }, [lnurlRequest?.lnurl]);

  useEffect(() => {
    if (!lnurlModalOpen || lnurlStatus !== 'polling' || !lnurlRequest) return;
    let active = true;
    const startedAt = Date.now();
    const expiresAt = lnurlRequest.expiresAt ? new Date(lnurlRequest.expiresAt).getTime() : null;

    const poll = async () => {
      if (!active) return;
      if (expiresAt && Date.now() > expiresAt) {
        setLnurlStatus('expired');
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setLnurlStatus('timeout');
        return;
      }
      try {
        const response = await fetch(`${apiBase}/api/lnurl-auth/status/${lnurlRequest.k1}`);
        if (!response.ok) {
          if (response.status === 404) {
            setLnurlStatus('expired');
            return;
          }
          throw new Error('Unable to check Lightning login status.');
        }
        const data = (await response.json()) as { status: string; linkingKey?: string | null };
        if (data.status === 'VERIFIED' && data.linkingKey) {
          setLnurlStatus('verified');
          loginWithLnurl(data.linkingKey).catch((err: unknown) => {
            setLnurlStatus('error');
            setLnurlError(err instanceof Error ? err.message : 'Lightning login failed.');
          });
          return;
        }
        if (data.status === 'EXPIRED') {
          setLnurlStatus('expired');
        }
      } catch (err: unknown) {
        setLnurlStatus('error');
        setLnurlError(err instanceof Error ? err.message : 'Lightning login failed.');
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [apiBase, lnurlModalOpen, lnurlRequest, lnurlStatus, loginWithLnurl]);

  const statusMessage = useMemo(() => {
    switch (lnurlStatus) {
      case 'loading':
        return 'Generating Lightning login request...';
      case 'polling':
        return 'Waiting for your wallet to confirm the login.';
      case 'verified':
        return 'Verified! Signing you in now.';
      case 'expired':
        return 'This login request expired. Generate a new QR.';
      case 'timeout':
        return 'Login timed out. Generate a new QR.';
      case 'error':
        return lnurlError ?? 'Lightning login failed.';
      default:
        return null;
    }
  }, [lnurlError, lnurlStatus]);

  const showRetry = lnurlStatus === 'error' || lnurlStatus === 'expired' || lnurlStatus === 'timeout';

  return (
    <div className="login-container">
      <div className="login-terminal">
        <div className="terminal-header">
          <span className="terminal-title">Sign in to NostrStack</span>
        </div>
        <div className="terminal-body">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--color-fg-default)' }}>Welcome back</h1>
            <p style={{ color: 'var(--color-fg-muted)' }}>Connect your Nostr identity to continue</p>
          </div>
          
          {error && (
            <div style={{ 
              backgroundColor: 'var(--color-danger-fg)', 
              color: 'white', 
              padding: '0.75rem', 
              borderRadius: '6px', 
              marginBottom: '1.5rem',
              fontSize: '0.9rem' 
            }}>
              {error}
            </div>
          )}

          {mode === 'menu' && (
            <div className="auth-options">
              <button className="auth-btn" onClick={() => loginWithNip07()}>
                Sign in with Extension (NIP-07)
              </button>
              <button className="auth-btn" onClick={openLnurlModal}>
                Login with Lightning (LNURL-auth)
              </button>
              <button className="auth-btn" style={{ background: 'transparent', borderStyle: 'dashed' }} onClick={() => setMode('nsec')}> 
                Enter nsec manually
              </button>
            </div>
          )}

          {mode === 'nsec' && (
            <div className="nsec-form">
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'var(--color-attention-fg)', 
                marginBottom: '1rem',
                backgroundColor: '#fff8c5',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--color-attention-fg)'
              }}>
                <strong>Warning:</strong> Entering your private key directly is risky. Use a burner key or an extension if possible.
              </div>
              <input 
                type="password" 
                className="terminal-input"
                id="nsec-input"
                name="nsec"
                placeholder="nsec1..." 
                value={nsec}
                onChange={e => setNsec(e.target.value)}
              />
              <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
                <button className="auth-btn" style={{ backgroundColor: 'var(--color-accent-fg)', color: 'white', border: 'none' }} onClick={() => loginWithNsec(nsec).catch(() => {})}>
                  Sign in
                </button>
                <button 
                  className="auth-btn" 
                  style={{ width: 'auto', border: 'none' }} 
                  onClick={() => setMode('menu')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {lnurlModalOpen && (
        <div className="lnurl-auth-overlay">
          <div className="lnurl-auth-modal">
            <div className="lnurl-auth-header">
              <div>
                <div className="lnurl-auth-title">Lightning Login</div>
                <div className="lnurl-auth-subtitle">Sign in by approving a LNURL-auth request.</div>
              </div>
              <button className="lnurl-auth-close" onClick={closeLnurlModal} aria-label="Close">
                ×
              </button>
            </div>
            <div className="lnurl-auth-body">
              {statusMessage && (
                <div className={`lnurl-auth-status ${lnurlStatus === 'error' ? 'is-error' : ''}`}>
                  {statusMessage}
                </div>
              )}

              {lnurlRequest && (
                <div className="lnurl-auth-grid">
                  <div className="lnurl-auth-qr">
                    {lnurlQr ? (
                      <img src={lnurlQr} alt="LNURL-auth QR" />
                    ) : (
                      <div className="lnurl-auth-qr-fallback">LNURL</div>
                    )}
                  </div>
                  <div className="lnurl-auth-meta">
                    <div className="lnurl-auth-chip">k1: {lnurlRequest.k1.slice(0, 8)}…</div>
                    <div className="lnurl-auth-instructions">
                      Scan with a Lightning wallet that supports LNURL-auth and approve the request.
                    </div>
                    <div className="lnurl-auth-actions">
                      <button className="action-btn" onClick={handleCopyLnurl}>
                        {copyStatus === 'copied' ? 'COPIED' : 'COPY_LNURL'}
                      </button>
                      <button className="action-btn" onClick={handleOpenWallet}>
                        OPEN_WALLET
                      </button>
                      {showRetry && (
                        <button className="action-btn" onClick={openLnurlModal}>
                          NEW_QR
                        </button>
                      )}
                    </div>
                    {copyStatus === 'error' && <div className="lnurl-auth-hint">Clipboard unavailable.</div>}
                  </div>
                </div>
              )}

              {!lnurlRequest && lnurlStatus === 'loading' && (
                <div className="lnurl-auth-loading">Preparing LNURL-auth request…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
