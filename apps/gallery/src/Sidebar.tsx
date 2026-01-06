import { useAuth, useBitcoinStatus, useNostrstackConfig, useStats } from '@nostrstack/blog-kit';
import { useEffect, useState } from 'react';

import { useWallet } from './hooks/useWallet';
import { Alert } from './ui/Alert';
import { useToast } from './ui/toast';
import { resolveApiBase } from './utils/api-base';
import { navigateTo } from './utils/navigation';
import { WalletView } from './WalletView';

interface SidebarProps {
  currentView: 'feed' | 'search' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings' | 'personal-site-kit' | 'messages';
  setCurrentView: (view: 'feed' | 'search' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings' | 'personal-site-kit' | 'messages') => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenHelp?: () => void;
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';

export function Sidebar({ currentView, setCurrentView, mobileOpen, onMobileClose, onOpenHelp }: SidebarProps) {
  const { eventCount } = useStats();
  const { logout } = useAuth();
  const cfg = useNostrstackConfig();
  const { status, refresh } = useBitcoinStatus();
  const wallet = useWallet();
  const toast = useToast();
  const [isFunding, setIsFunding] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [devNetworkOverride, setDevNetworkOverride] = useState<string | null>(null);

  const apiBaseRaw = cfg.apiBase ?? cfg.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const apiBaseConfig = cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw);
  const apiBase = apiBaseConfig.baseUrl;
  const regtestFundEnabled =
    String(import.meta.env.VITE_ENABLE_REGTEST_FUND ?? '').toLowerCase() === 'true' || import.meta.env.DEV;
  const bolt12Enabled =
    String(import.meta.env.VITE_ENABLE_BOLT12 ?? '').toLowerCase() === 'true' || import.meta.env.DEV;
  const statusNetwork = status?.configuredNetwork ?? status?.network;
  const configuredNetworkRaw =
    devNetworkOverride ?? statusNetwork ?? String(import.meta.env.VITE_NETWORK ?? 'regtest').trim();
  const configuredNetwork = (configuredNetworkRaw || 'regtest').trim();
  const isMainnet = configuredNetwork.toLowerCase() === 'mainnet';
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
    String(import.meta.env.VITE_ENABLE_LNURL_WITHDRAW ?? '').toLowerCase() === 'true' || import.meta.env.DEV;
  const withdrawAvailable = withdrawEnabled && apiBaseConfig.isConfigured && (wallet?.balance ?? 0) >= 1;
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
      toast({ message: regtestUnavailableReason ?? 'Regtest funding unavailable.', tone: 'danger' });
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
      const data = JSON.parse(bodyText) as { minedBlocks?: number; lnbitsTopup?: number; currentBlockHeight?: number };
      const mined = data.minedBlocks ?? 0;
      const topup = data.lnbitsTopup;

      if (data.currentBlockHeight) {
        window.dispatchEvent(new CustomEvent('nostrstack:manual-block-update', { detail: { height: data.currentBlockHeight } }));
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
    if (view === 'personal-site-kit') {
      navigateTo('/personal-site-kit');
      setCurrentView('personal-site-kit');
      onMobileClose?.();
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/search')) {
      navigateTo('/');
    }
    setCurrentView(view);
    onMobileClose?.();
  };

  return (
    <nav className={`sidebar-nav${mobileOpen ? ' is-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>NostrStack</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-fg-muted)', fontWeight: 'normal', border: '1px solid var(--color-border-default)', padding: '0 4px', borderRadius: '4px' }}>v1.0</span>
        </div>
      </div>
      
      <div style={{ padding: '0 0.5rem', marginBottom: '1rem' }}>
        <button 
          className={`nav-item ${currentView === 'feed' ? 'active' : ''}`}
          onClick={() => handleNavigate('feed')}
          aria-current={currentView === 'feed' ? 'page' : undefined}
        >
          Feed
        </button>
        <button 
          className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => handleNavigate('search')}
          aria-current={currentView === 'search' ? 'page' : undefined}
        >
          Find friend
        </button>
        <button 
          className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
          onClick={() => handleNavigate('profile')}
          aria-current={currentView === 'profile' ? 'page' : undefined}
        >
          Profile
        </button>
        <button 
          className={`nav-item ${currentView === 'notifications' ? 'active' : ''}`}
          onClick={() => handleNavigate('notifications')}
          aria-current={currentView === 'notifications' ? 'page' : undefined}
        >
          Notifications
        </button>
        <button 
          className={`nav-item ${currentView === 'messages' ? 'active' : ''}`}
          onClick={() => handleNavigate('messages')}
          aria-current={currentView === 'messages' ? 'page' : undefined}
        >
          Messages
        </button>
        <button 
          className={`nav-item ${currentView === 'personal-site-kit' ? 'active' : ''}`}
          onClick={() => handleNavigate('personal-site-kit')}
          aria-current={currentView === 'personal-site-kit' ? 'page' : undefined}
        >
          Site Kit
        </button>
        <button 
          className={`nav-item ${currentView === 'relays' ? 'active' : ''}`}
          onClick={() => handleNavigate('relays')}
          aria-current={currentView === 'relays' ? 'page' : undefined}
        >
          Relays
        </button>
        {bolt12Enabled && (
          <button
            className={`nav-item ${currentView === 'offers' ? 'active' : ''}`}
            onClick={() => handleNavigate('offers')}
            aria-current={currentView === 'offers' ? 'page' : undefined}
          >
            Offers
          </button>
        )}
        <button 
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavigate('settings')}
          aria-current={currentView === 'settings' ? 'page' : undefined}
        >
          Settings
        </button>
        {onOpenHelp && (
          <button 
            className="nav-item"
            onClick={() => { onOpenHelp(); onMobileClose?.(); }}
            aria-label="Open help and keyboard shortcuts"
          >
            Help
          </button>
        )}
      </div>

      <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--color-border-default)' }} role="region" aria-label="Wallet and system status">
        {wallet && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Wallet</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600' }} role="status" aria-label={`Wallet balance: ${wallet.balance?.toLocaleString() ?? 0} sats`}>
              {wallet.balance?.toLocaleString() ?? 0} <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>sats</span>
            </div>
            {(wallet.balance ?? 0) === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-accent-fg)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                Your wallet is empty. Ready to stack some sats?
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', marginTop: '0.25rem' }}>{wallet.name || 'LNbits'}</div>
            {showRegtestActions && (
              <div className="wallet-actions" role="group" aria-label="Wallet actions">
                <button
                  type="button"
                  className="wallet-action-btn"
                  onClick={handleRegtestFund}
                  disabled={isFunding || !apiBaseConfig.isConfigured}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  aria-busy={isFunding}
                  aria-label={isFunding ? 'Mining regtest blocks' : 'Add funds to wallet using regtest'}
                >
                  {!apiBaseConfig.isConfigured
                    ? 'REGTEST_CONFIG_REQUIRED'
                    : isFunding
                      ? (
                        <>
                          <span className="nostrstack-spinner" style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                          Mining regtest blocks…
                        </>
                      )
                      : 'Add funds (regtest)'}
                </button>
                <button
                  type="button"
                  className="wallet-action-btn"
                  onClick={() => setWithdrawOpen(true)}
                  disabled={!withdrawAvailable}
                  aria-label="Withdraw sats via LNURL"
                >
                  {!withdrawAvailable ? withdrawUnavailableReason : 'Withdraw via LNURL'}
                </button>
                {regtestUnavailableReason && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--color-fg-muted)' }}>
                    {regtestUnavailableReason}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div style={{ marginBottom: '1rem' }} role="status" aria-label="Network and system status">
          <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Network
          </div>
          <div className="sidebar-network-badges">
            <span className={`sidebar-network-badge is-${configuredNetwork.toLowerCase()}`}>
              {configuredNetwork.toUpperCase()}
            </span>
            {status?.source && <span className="sidebar-network-badge is-muted">SOURCE: {sourceLabel}</span>}
          </div>
          <div className="sidebar-network-meta">
            <span className={`sidebar-network-status is-${lightningTone}`}>{lightningLabel}</span>
          </div>
          {status?.telemetryError && (
            <div className="sidebar-network-meta sidebar-network-warning" role="alert">Telemetry: {status.telemetryError}</div>
          )}
          <div className="sidebar-network-meta" aria-label={`${eventCount} events in feed`}>Events: {eventCount}</div>
          {isMainnet && (
            <Alert tone="danger" title="Mainnet enabled" style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
              Real sats and payments are live.
            </Alert>
          )}
        </div>

        <button className="nav-item" onClick={logout} style={{ color: 'var(--color-danger-fg)', paddingLeft: 0 }} aria-label="Log out of NostrStack">
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
}
