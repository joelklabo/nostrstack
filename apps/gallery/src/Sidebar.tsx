import { useAuth,useStats } from '@nostrstack/blog-kit';
import { useEffect, useState } from 'react';

interface SidebarProps {
  currentView: 'feed' | 'profile' | 'notifications';
  setCurrentView: (view: 'feed' | 'profile' | 'notifications') => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const [uptime, setUptime] = useState(0);
  const { eventCount } = useStats();
  const { logout } = useAuth();

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setUptime(Date.now() - start);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h.toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  };

  return (
    <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '2rem', padding: '0.8rem', border: '1px solid var(--terminal-text)' }}>
        NOSTRSTACK_V1
        <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: 'var(--terminal-dim)' }}>
          UPTIME: {formatUptime(uptime)}
        </div>
        <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: 'var(--terminal-dim)' }}>
          EVENTS_RX: {eventCount}
        </div>
      </div>
      
      <button 
        className={`nav-item ${currentView === 'feed' ? 'active' : ''}`}
        onClick={() => setCurrentView('feed')}
      >
        FEED_GLOBAL
      </button>
      <button 
        className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
        onClick={() => setCurrentView('profile')}
      >
        PROFILE
      </button>
      <button 
        className={`nav-item ${currentView === 'notifications' ? 'active' : ''}`}
        onClick={() => setCurrentView('notifications')}
      >
        NOTIFICATIONS
      </button>
      <button className="nav-item">SETTINGS</button>
      
      <div style={{ marginTop: 'auto', paddingBottom: '1rem' }}>
        <button className="nav-item" onClick={logout}>LOGOUT</button>
      </div>
    </nav>
  );
}
