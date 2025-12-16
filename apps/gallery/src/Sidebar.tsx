interface SidebarProps {
  currentView: 'feed' | 'profile';
  setCurrentView: (view: 'feed' | 'profile') => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  return (
    <nav className="sidebar-nav">
      <div style={{ marginBottom: '2rem', padding: '0.8rem', border: '1px solid var(--terminal-text)' }}>
        NOSTRSTACK_V1
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
      <button className="nav-item">NOTIFICATIONS</button>
      <button className="nav-item">SETTINGS</button>
      
      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <button className="nav-item" onClick={() => window.location.reload()}>LOGOUT</button>
      </div>
    </nav>
  );
}
