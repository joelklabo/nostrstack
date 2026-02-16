import { useAuth, useBitcoinStatus, useNostrstackConfig, useStats } from '@nostrstack/react';
import { useToast } from '@nostrstack/ui';
import { memo, useEffect, useRef, useState } from 'react';

import { WalletView } from '../features/wallet/WalletView';
import { useWallet } from '../hooks/useWallet';
import { AnimatedSats } from '../ui/AnimatedNumber';
import { resolveGalleryApiBase } from '../utils/api-base';
import { navigateTo, navigateToProfile } from '../utils/navigation';

interface SidebarProps {
  currentView: 'feed' | 'search' | 'profile' | 'settings';
  setCurrentView: (view: 'feed' | 'search' | 'profile' | 'settings') => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenHelp?: () => void;
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';

export const Sidebar = memo(function Sidebar({
  currentView,
  setCurrentView,
  mobileOpen,
  onMobileClose,
  onOpenHelp
}: SidebarProps) {
  const { eventCount } = useStats();
  const { logout, pubkey } = useAuth();
  const cfg = useNostrstackConfig();
  const { status, refresh } = useBitcoinStatus();
  const {
    wallet,
    isConnecting: walletConnecting,
    error: walletError,
    retry: walletRetry
  } = useWallet();
  const toast = useToast();
  const [isFunding, setIsFunding] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [devNetworkOverride, setDevNetworkOverride] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const prevBalanceRef = useRef(wallet?.balance ?? 0);

  // Detect balance increases for "receiving" animation
  useEffect(() => {
    const currentBalance = wallet?.balance ?? 0;
    if (currentBalance > prevBalanceRef.current) {
      setIsReceiving(true);
      const timeout = setTimeout(() => setIsReceiving(false), 2000);
      prevBalanceRef.current = currentBalance;
      return () => clearTimeout(timeout);
    }
    prevBalanceRef.current = currentBalance;
    return undefined;
  }, [wallet?.balance]);

  const apiBaseConfig = resolveGalleryApiBase(cfg);
  const apiBase = apiBaseConfig.baseUrl;
  const regtestFundEnabled =
    String(import.meta.env.VITE_ENABLE_REGTEST_FUND ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;
  const statusNetwork = status?.configuredNetwork ?? status?.network;
  const configuredNetworkRaw =
    devNetworkOverride ?? statusNetwork ?? String(import.meta.env.VITE_NETWORK ?? 'regtest').trim();
  const configuredNetwork = (configuredNetworkRaw || 'regtest').trim();
  const sourceLabel = status?.source ? status.source.toUpperCase() : '—';
  const provider = status?.lightning?.provider;
  const lnbitsStatus = status?.lightning?.lnbits?.status;
  let lightningLabel = provider ? `Provider: ${provider}` : 'Provider: —';
  let lightningTone: 'neutral' | 'success' | 'danger' = 'neutral';
  if (provider === 'lnbits') {
    if (lnbitsStatus === 'ok') {
      lightningLabel = 'LNbits: OK';
      lightningTone = 'success';
    } else if (lnbitsStatus === 'fail' || lnbitsStatus === 'error') {
      lightningLabel = `LNbits: ${String(lnbitsStatus).toUpperCase()}`;
      lightningTone = 'danger';
    } else if (lnbitsStatus === 'skipped') {
      lightningLabel = 'LNbits: Skipped';
    } else {
      lightningLabel = 'LNbits: Unknown';
    }
  }
  const showRegtestActions = regtestFundEnabled;
  const withdrawEnabled =
    String(import.meta.env.VITE_ENABLE_LNURL_WITHDRAW ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;
  const withdrawAvailable =
    withdrawEnabled && apiBaseConfig.isConfigured && (wallet?.balance ?? 0) >= 1;
  const withdrawUnavailableReason = !withdrawEnabled
    ? 'Withdrawals disabled.'
    : !apiBaseConfig.isConfigured
      ? 'Withdrawals require API base.'
      : 'Insufficient balance.';
  const regtestUnavailableReason =
    regtestFundEnabled && !apiBaseConfig.isConfigured
      ? 'Regtest funding unavailable (API base not configured).'
      : null;

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const readOverride = () => {
      const raw = window.localStorage.getItem(DEV_NETWORK_KEY);
      const value = raw ? raw.trim() : '';
      setDevNetworkOverride(value || null);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEV_NETWORK_KEY) readOverride();
    };
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      setDevNetworkOverride(detail && detail.trim() ? detail.trim() : null);
    };
    readOverride();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nostrstack:dev-network', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:dev-network', handleCustom as EventListener);
    };
  }, []);

  const handleRegtestFund = async () => {
    if (isFunding) return;
    if (!apiBaseConfig.isConfigured) {
      toast({
        message: regtestUnavailableReason ?? 'Regtest funding unavailable.',
        tone: 'danger'
      });
      return;
    }
    setIsFunding(true);
    try {
      const url = apiBase ? `${apiBase}/api/regtest/fund` : '/api/regtest/fund';
      const res = await fetch(url, { method: 'POST' });
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(bodyText || `HTTP ${res.status}`);
      }
      const data = JSON.parse(bodyText) as {
        minedBlocks?: number;
        lnbitsTopup?: number;
        currentBlockHeight?: number;
      };
      const mined = data.minedBlocks ?? 0;
      const topup = data.lnbitsTopup;

      if (data.currentBlockHeight) {
        window.dispatchEvent(
          new CustomEvent('nostrstack:manual-block-update', {
            detail: { height: data.currentBlockHeight }
          })
        );
        refresh();
      }

      const msg = topup
        ? `Funded & mined ${mined} blocks (+${topup.toLocaleString()} sats).`
        : `Funded & mined ${mined} blocks.`;
      toast({ message: msg, tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regtest funding failed.';
      toast({ message, tone: 'danger' });
    } finally {
      setIsFunding(false);
    }
  };

  const handleNavigate = (view: SidebarProps['currentView']) => {
    if (view === 'search') {
      navigateTo('/search');
      setCurrentView('search');
      onMobileClose?.();
      return;
    }
    if (view === 'settings') {
      navigateTo('/settings');
      setCurrentView('settings');
      onMobileClose?.();
      return;
    }
    if (view === 'profile') {
      if (pubkey) {
        navigateToProfile(pubkey);
      } else {
        setCurrentView('profile');
      }
      onMobileClose?.();
      return;
    }
    if (window.location.pathname !== '/') {
      navigateTo('/');
    }
    setCurrentView('feed');
    onMobileClose?.();
  };

  return (
    <nav className={`sidebar-nav${mobileOpen ? ' is-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <h1 className="sidebar-title">
          <span>NostrStack</span>
          <span className="version-badge">v1.0</span>
        </h1>
      </div>

      <div className="sidebar-nav-items">
        <button
          type="button"
          className={`nav-item ${currentView === 'feed' ? 'active' : ''}`}
          onClick={() => handleNavigate('feed')}
          aria-current={currentView === 'feed' ? 'page' : undefined}
        >
          Feed
        </button>
        <button
          type="button"
          className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => handleNavigate('search')}
          aria-current={currentView === 'search' ? 'page' : undefined}
        >
          Find friend
        </button>
        <button
          type="button"
          className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
          onClick={() => handleNavigate('profile')}
          aria-current={currentView === 'profile' ? 'page' : undefined}
        >
          Profile
        </button>
        <button
          type="button"
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavigate('settings')}
          aria-current={currentView === 'settings' ? 'page' : undefined}
        >
          Settings
        </button>
        {onOpenHelp && (
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              onOpenHelp();
              onMobileClose?.();
            }}
            aria-label="Open help and keyboard shortcuts"
          >
            Help
          </button>
        )}
      </div>

      <div className="sidebar-footer" role="region" aria-label="Wallet and system status">
        {walletConnecting && (
          <div className="sidebar-wallet-section">
            <div className="sidebar-status-label">
              <span className="sidebar-wallet-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                </svg>
              </span>
              Wallet
            </div>
            <div className="sidebar-wallet-empty">
              <p>Connecting to wallet...</p>
            </div>
          </div>
        )}
        {!walletConnecting && walletError && (
          <div className="sidebar-wallet-section" role="status" aria-live="polite">
            <div className="sidebar-status-label">
              <span className="sidebar-wallet-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                </svg>
              </span>
              Wallet
            </div>
            <div className="sidebar-wallet-empty">
              <p>Wallet unavailable</p>
              <p className="sidebar-wallet-hint">{walletError}</p>
              {walletError !== 'No wallet URL configured' && (
                <button type="button" className="wallet-action-btn" onClick={walletRetry}>
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
        {!walletConnecting && !walletError && wallet && (
          <div
            className={`sidebar-wallet-section ${isReceiving ? 'is-receiving' : ''} ${(wallet.balance ?? 0) > 0 ? 'has-balance' : ''}`}
          >
            <div className="sidebar-status-label">
              <span className="sidebar-wallet-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                </svg>
              </span>
              Wallet
              {isReceiving && <span className="sidebar-receiving-badge">Receiving</span>}
            </div>
            <div
              className={`sidebar-wallet-balance ${isReceiving ? 'is-glowing' : ''}`}
              role="status"
              aria-label={`Wallet balance: ${wallet.balance?.toLocaleString() ?? 0} sats`}
            >
              <AnimatedSats
                value={wallet.balance ?? 0}
                showUnit={true}
                unitClassName="sidebar-wallet-unit"
              />
            </div>
            {(wallet.balance ?? 0) === 0 && (
              <div className="sidebar-wallet-empty">
                <p>Your wallet is empty.</p>
                <p className="sidebar-wallet-hint">
                  Receive sats via Lightning address or zap to get started!
                </p>
              </div>
            )}
            <div className="sidebar-network-meta">{wallet.name || 'LNbits'}</div>
            {showRegtestActions && (
              <div className="wallet-actions" role="group" aria-label="Wallet actions">
                <button
                  type="button"
                  className="wallet-action-btn"
                  onClick={handleRegtestFund}
                  disabled={isFunding || !apiBaseConfig.isConfigured}
                  aria-busy={isFunding}
                  aria-label={
                    isFunding
                      ? 'Mining regtest funds'
                      : !apiBaseConfig.isConfigured
                        ? 'Regtest funding unavailable'
                        : 'Add funds to regtest wallet'
                  }
                >
                  {!apiBaseConfig.isConfigured ? (
                    'Configuration needed'
                  ) : isFunding ? (
                    <>
                      <span className="ns-spinner" style={{ width: '12px', height: '12px' }} />
                      Mining...
                    </>
                  ) : (
                    'Add funds (regtest)'
                  )}
                </button>
                <button
                  type="button"
                  className="wallet-action-btn"
                  onClick={() => setWithdrawOpen(true)}
                  disabled={!withdrawAvailable}
                  aria-label={
                    withdrawAvailable ? 'Open LNURL withdraw flow' : withdrawUnavailableReason
                  }
                >
                  {!withdrawAvailable ? withdrawUnavailableReason : 'Withdraw via LNURL'}
                </button>
              </div>
            )}
          </div>
        )}

        <div
          className="sidebar-network-section"
          role="status"
          aria-label="Network and system status"
        >
          <div className="sidebar-status-label">Network</div>
          <div className="sidebar-network-badges">
            <span className={`sidebar-network-badge is-${configuredNetwork.toLowerCase()}`}>
              {configuredNetwork.toUpperCase()}
            </span>
            {status?.source && <span className="sidebar-network-badge">SOURCE: {sourceLabel}</span>}
          </div>
          <div className="sidebar-network-meta">
            <span className={`sidebar-network-status is-${lightningTone}`}>{lightningLabel}</span>
          </div>
          <div className="sidebar-network-meta" aria-label={`${eventCount} events in feed`}>
            Events: {eventCount}
          </div>
        </div>

        <button
          type="button"
          className="nav-item nav-item--danger"
          onClick={() => {
            onMobileClose?.();
            logout();
          }}
        >
          Log out
        </button>
      </div>

      {withdrawOpen && (
        <WalletView
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          balanceSats={wallet?.balance}
          apiBase={apiBase}
          apiConfigured={apiBaseConfig.isConfigured}
          withdrawEnabled={withdrawEnabled}
        />
      )}
    </nav>
  );
});
