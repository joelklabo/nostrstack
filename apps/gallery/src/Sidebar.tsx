import { useAuth, useStats } from '@nostrstack/blog-kit';
import { useState } from 'react';

import { useWallet } from './hooks/useWallet';
import { useToast } from './ui/toast';

interface SidebarProps {
  currentView: 'feed' | 'profile' | 'notifications' | 'relays' | 'settings';
  setCurrentView: (view: 'feed' | 'profile' | 'notifications' | 'relays' | 'settings') => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { eventCount } = useStats();
  const { logout } = useAuth();
  const wallet = useWallet();
  const toast = useToast();
  const [isFunding, setIsFunding] = useState(false);

  const apiBaseRaw = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const isMockBase = apiBaseRaw === 'mock';
  const apiBase = preferSecureBase(apiBaseRaw === '/api' ? '' : apiBaseRaw.replace(/\/$/, ''));
  const showRegtestActions = import.meta.env.DEV;

  const handleRegtestFund = async () => {
    if (isFunding) return;
    if (isMockBase) {
      toast({ message: 'Regtest funding unavailable (API base not configured).', tone: 'danger' });
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
      const data = JSON.parse(bodyText) as { minedBlocks?: number; lnbitsTopup?: number };
      const mined = data.minedBlocks ?? 0;
      const topup = data.lnbitsTopup;
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

  function preferSecureBase(base: string) {
    if (typeof window === 'undefined') return base;
    if (window.location.protocol !== 'https:') return base;
    if (!/^http:\/\//i.test(base)) return base;
    return base.replace(/^http:/i, 'https:');
  }

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
          onClick={() => setCurrentView('feed')}
        >
          Feed
        </button>
        <button 
          className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
          onClick={() => setCurrentView('profile')}
        >
          Profile
        </button>
        <button 
          className={`nav-item ${currentView === 'notifications' ? 'active' : ''}`}
          onClick={() => setCurrentView('notifications')}
        >
          Notifications
        </button>
        <button 
          className={`nav-item ${currentView === 'relays' ? 'active' : ''}`}
          onClick={() => setCurrentView('relays')}
        >
          Relays
        </button>
        <button 
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentView('settings')}
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
                  disabled={isFunding}
                >
                  {isFunding ? 'Mining regtest blocks…' : 'Add funds (regtest)'}
                </button>
              </div>
            )}
          </div>
        )}
        
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Network</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-fg-default)' }}>
            Events: {eventCount}
          </div>
        </div>

        <button className="nav-item" onClick={logout} style={{ color: 'var(--color-danger-fg)', paddingLeft: 0 }}>
          Log out
        </button>
      </div>
    </nav>
  );
}
