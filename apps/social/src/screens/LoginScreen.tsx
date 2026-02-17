import { resolveApiBase, useAuth, useNostrstackConfig } from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type LnurlAuthRequest = {
  k1: string;
  callback: string;
  lnurl: string;
  expiresAt: string;
};

type LnurlAuthStatus =
  | 'idle'
  | 'loading'
  | 'polling'
  | 'verified'
  | 'expired'
  | 'timeout'
  | 'error';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

export function LoginScreen() {
  const { loginWithNip07, loginWithNsec, loginWithLnurl, error: authError } = useAuth();
  const cfg = useNostrstackConfig();
  const [nsec, setNsec] = useState('');
  const [nsecError, setNsecError] = useState<string | null>(null);
  const [mode, setMode] = useState<'menu' | 'nsec' | 'guest'>('menu');
  const [lnurlModalOpen, setLnurlModalOpen] = useState(false);
  const [lnurlRequest, setLnurlRequest] = useState<LnurlAuthRequest | null>(null);
  const [lnurlStatus, setLnurlStatus] = useState<LnurlAuthStatus>('idle');
  const [lnurlError, setLnurlError] = useState<string | null>(null);
  const [lnurlQr, setLnurlQr] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [throwawayKey, setThrowawayKey] = useState<{ nsec: string; npub: string } | null>(null);
  const enableLnurlAuth =
    String(import.meta.env.VITE_ENABLE_LNURL_AUTH ?? '').toLowerCase() === 'true';
  const lnurlModalRef = useRef<HTMLDivElement>(null);
  const firstAuthButtonRef = useRef<HTMLButtonElement>(null);
  const lnurlTriggerRef = useRef<HTMLElement | null>(null);

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
    if (!enableLnurlAuth) {
      return;
    }
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
  }, [apiBase, apiBaseConfig.isConfigured, enableLnurlAuth]);

  const closeLnurlModal = useCallback(() => {
    setLnurlModalOpen(false);
    setLnurlRequest(null);
    setLnurlStatus('idle');
    setLnurlError(null);
    setLnurlQr(null);
    setCopyStatus('idle');
  }, []);

  // Handle Escape key to close LNURL modal
  useEffect(() => {
    if (!lnurlModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLnurlModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lnurlModalOpen, closeLnurlModal]);

  // Focus management for LNURL modal
  useEffect(() => {
    if (!lnurlModalOpen) return;

    // Store trigger element
    lnurlTriggerRef.current = document.activeElement as HTMLElement;

    // Focus first button when modal opens
    const modal = lnurlModalRef.current;
    if (!modal) return;

    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }

    // Return focus on close
    return () => {
      if (lnurlTriggerRef.current && document.contains(lnurlTriggerRef.current)) {
        lnurlTriggerRef.current.focus();
      }
    };
  }, [lnurlModalOpen]);

  // Focus trap for LNURL modal
  useEffect(() => {
    if (!lnurlModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = lnurlModalRef.current;
      if (!modal) return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lnurlModalOpen]);

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

  const handleCreateThrowawayKey = useCallback(() => {
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(publicKey);
    setThrowawayKey({ nsec, npub });
  }, []);

  const handleUseThrowawayKey = useCallback(async () => {
    if (!throwawayKey) return;
    setNsec(throwawayKey.nsec);
    setThrowawayKey(null);
    try {
      await loginWithNsec(throwawayKey.nsec);
    } catch (err) {
      setNsecError(err instanceof Error ? err.message : 'Invalid private key');
    }
  }, [throwawayKey, loginWithNsec]);

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

  const showRetry =
    lnurlStatus === 'error' || lnurlStatus === 'expired' || lnurlStatus === 'timeout';

  useEffect(() => {
    if (mode === 'menu') {
      firstAuthButtonRef.current?.focus();
    }
  }, [mode]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Sign in to NostrStack</h1>
          <p className="login-subtitle">Connect your identity to get started</p>
        </div>

        {(authError || nsecError) && (
          <Alert tone="danger" role="alert">
            {nsecError ?? authError}
          </Alert>
        )}

        {mode === 'menu' && (
          <div className="auth-options" role="group" aria-label="Authentication methods">
            <button
              type="button"
              ref={firstAuthButtonRef}
              className="auth-btn auth-btn--primary"
              onClick={() => {
                void loginWithNip07().catch(() => {});
              }}
              aria-label="Sign in with Nostr browser extension"
            >
              Sign in with Extension
            </button>
            {enableLnurlAuth && (
              <button
                type="button"
                className="auth-btn auth-btn--secondary"
                onClick={openLnurlModal}
                aria-label="Login using Lightning wallet"
              >
                Login with Lightning
              </button>
            )}
            <button
              type="button"
              className="auth-btn auth-btn--outline"
              onClick={() => setMode('nsec')}
              aria-label="Enter private key manually"
            >
              Enter nsec manually
            </button>
            <button
              type="button"
              className="auth-btn auth-btn--ghost"
              onClick={() => {
                localStorage.setItem('nostrstack.guest', 'true');
                window.location.reload();
              }}
              aria-label="Browse as guest"
            >
              Browse as Guest
            </button>
          </div>
        )}

        {mode === 'nsec' && (
          <form
            className="nsec-form"
            style={{ display: 'grid', gap: '1.25rem' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!nsec.trim()) {
                setNsecError('Please enter a private key');
                return;
              }
              setNsecError(null);
              loginWithNsec(nsec).catch((err) => {
                setNsecError(err instanceof Error ? err.message : 'Invalid private key');
              });
            }}
          >
            <Alert tone="warning">
              <strong>Security Warning:</strong> Entering your private key directly is risky. Use a
              browser extension if possible.
            </Alert>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label htmlFor="nsec-input" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                Private key (nsec)
              </label>
              <input
                type="password"
                className="ns-input"
                id="nsec-input"
                name="nsec"
                placeholder="nsec1..."
                value={nsec}
                onChange={(e) => setNsec(e.target.value)}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional for modal/form UX
                autoFocus
              />
            </div>
            <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                className="auth-btn auth-btn--primary"
                aria-label="Sign in with private key"
              >
                Sign in
              </button>
              <button
                type="button"
                className="auth-btn auth-btn--secondary"
                onClick={() => setMode('menu')}
                aria-label="Cancel and go back"
              >
                Cancel
              </button>
            </div>

            {!throwawayKey && (
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="auth-btn auth-btn--ghost"
                  onClick={handleCreateThrowawayKey}
                  style={{ fontSize: '0.85rem' }}
                  aria-label="Create throwaway key"
                >
                  Create throwaway key
                </button>
              </div>
            )}

            {throwawayKey && (
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  padding: '1rem',
                  background: 'var(--ns-color-bg-subtle)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.7 }}>
                  Throwaway Key Created
                </div>
                <div style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  <strong>npub:</strong> {throwawayKey.npub.slice(0, 20)}...
                </div>
                <Alert tone="warning" style={{ fontSize: '0.8rem' }}>
                  Save this key! It only exists in your browser and cannot be recovered.
                </Alert>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="auth-btn auth-btn--primary"
                    onClick={handleUseThrowawayKey}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    aria-label="Use this key"
                  >
                    Use this key
                  </button>
                  <button
                    type="button"
                    className="auth-btn auth-btn--secondary"
                    onClick={() => {
                      setThrowawayKey(null);
                      setNsec('');
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    aria-label="Cancel throwaway key"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {lnurlModalOpen && (
        <div className="ns-dialog-overlay lnurl-auth-modal">
          <div
            ref={lnurlModalRef}
            className="ns-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lnurl-title"
            aria-describedby="lnurl-subtitle"
          >
            <div className="ns-dialog__header">
              <div>
                <div
                  id="lnurl-title"
                  className="lnurl-auth-title"
                  style={{ fontSize: '1.1rem', fontWeight: 800 }}
                >
                  Lightning Login
                </div>
                <div id="lnurl-subtitle" style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Approve the request in your wallet.
                </div>
              </div>
              <button
                type="button"
                className="lnurl-auth-close"
                style={{
                  fontSize: '1.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                onClick={closeLnurlModal}
                aria-label="Close Lightning login dialog"
              >
                ×
              </button>
            </div>
            <div className="ns-dialog__body">
              {statusMessage && (
                <Alert
                  tone={
                    lnurlStatus === 'error' ||
                    lnurlStatus === 'expired' ||
                    lnurlStatus === 'timeout'
                      ? 'danger'
                      : lnurlStatus === 'verified'
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
                >
                  {(lnurlStatus === 'loading' || lnurlStatus === 'verified') && (
                    <span className="ns-spinner" aria-hidden="true" />
                  )}
                  {statusMessage}
                </Alert>
              )}

              {lnurlRequest && (
                <div className="ns-dialog__grid">
                  <div className="ns-dialog__qr">
                    {lnurlQr ? (
                      <img
                        src={lnurlQr}
                        alt="Scan this QR code with your Lightning wallet to login"
                      />
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center' }}>QR unavailable</div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        padding: '0.25rem 0.6rem',
                        background: 'var(--ns-color-bg-subtle)',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        width: 'fit-content'
                      }}
                    >
                      k1: {lnurlRequest.k1.slice(0, 8)}…
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                      Scan with a Lightning wallet that supports LNURL-auth.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="ns-btn ns-btn--sm"
                        onClick={handleCopyLnurl}
                        aria-label="Copy LNURL to clipboard"
                      >
                        {copyStatus === 'copied' ? 'COPIED' : 'COPY'}
                      </button>
                      <button
                        type="button"
                        className="ns-btn ns-btn--primary ns-btn--sm"
                        onClick={handleOpenWallet}
                        aria-label="Open lightning wallet"
                      >
                        OPEN WALLET
                      </button>
                      {showRetry && (
                        <button
                          type="button"
                          className="ns-btn ns-btn--sm"
                          onClick={openLnurlModal}
                          aria-label="Retry lightning login"
                        >
                          RETRY
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
