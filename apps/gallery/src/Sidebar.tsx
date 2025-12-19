import { useAuth, useStats } from '@nostrstack/blog-kit';
import { useWallet } from './hooks/useWallet';

interface SidebarProps {
  currentView: 'feed' | 'profile' | 'notifications' | 'relays' | 'settings';
  setCurrentView: (view: 'feed' | 'profile' | 'notifications' | 'relays' | 'settings') => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { eventCount } = useStats();
  const { logout } = useAuth();
  const wallet = useWallet();

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
