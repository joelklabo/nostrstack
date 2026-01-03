import { useAuth, useBitcoinStatus, useNostrstackConfig, useStats } from '@nostrstack/blog-kit';
import { type CSSProperties, useEffect, useState } from 'react';

import { useWallet } from './hooks/useWallet';
import { useToast } from './ui/toast';
import { resolveApiBase } from './utils/api-base';
import { navigateTo } from './utils/navigation';
import { WalletView } from './WalletView';

interface SidebarProps {
  currentView: 'feed' | 'search' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings' | 'personal-site-kit';
  setCurrentView: (view: 'feed' | 'search' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings' | 'personal-site-kit') => void;
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
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
      return;
    }
    if (view === 'personal-site-kit') {
      navigateTo('/personal-site-kit');
      setCurrentView('personal-site-kit');
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/search')) {
      navigateTo('/');
    }
    setCurrentView(view);
  };

  return (
    <nav className="sidebar-nav">
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
        >
          Feed
        </button>
        <button 
          className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => handleNavigate('search')}
        >
          Find friend
        </button>
        <button 
          className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
          onClick={() => handleNavigate('profile')}
        >
          Profile
        </button>
        <button 
          className={`nav-item ${currentView === 'notifications' ? 'active' : ''}`}
          onClick={() => handleNavigate('notifications')}
        >
          Notifications
        </button>
        <button 
          className={`nav-item ${currentView === 'personal-site-kit' ? 'active' : ''}`}
          onClick={() => handleNavigate('personal-site-kit')}
        >
          Site Kit
        </button>
        <button 
          className={`nav-item ${currentView === 'relays' ? 'active' : ''}`}
          onClick={() => handleNavigate('relays')}
        >
          Relays
        </button>
        {bolt12Enabled && (
          <button
            className={`nav-item ${currentView === 'offers' ? 'active' : ''}`}
            onClick={() => handleNavigate('offers')}
          >
            Offers
          </button>
        )}
        <button 
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavigate('settings')}
        >
          Settings
        </button>
      </div>

      <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--color-border-default)' }}>
        {wallet && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Wallet</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
              {wallet.balance?.toLocaleString() ?? 0} <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>sats</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>{wallet.name || 'LNbits'}</div>
            {showRegtestActions && (
              <div className="wallet-actions">
                <button
                  type="button"
                  className="wallet-action-btn"
                  onClick={handleRegtestFund}
                  disabled={isFunding || !apiBaseConfig.isConfigured}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  aria-busy={isFunding}
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
        
        <div style={{ marginBottom: '1rem' }}>
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
            <div className="sidebar-network-meta sidebar-network-warning">Telemetry: {status.telemetryError}</div>
          )}
          <div className="sidebar-network-meta">Events: {eventCount}</div>
          {isMainnet && (
            <div
              className="nostrstack-callout"
              style={{
                marginTop: '0.5rem',
                '--nostrstack-callout-tone': 'var(--nostrstack-color-danger)'
              } as CSSProperties}
            >
              <div className="nostrstack-callout__title">Mainnet enabled</div>
              <div className="nostrstack-callout__content">Real sats and payments are live.</div>
            </div>
          )}
        </div>

        <button className="nav-item" onClick={logout} style={{ color: 'var(--color-danger-fg)', paddingLeft: 0 }}>
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
