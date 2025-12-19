import { AuthProvider, StatsProvider, useAuth } from '@nostrstack/blog-kit';
import {
  applyNostrstackTheme,
  createNostrstackBrandTheme,
  type NostrstackBrandPreset
} from '@nostrstack/embed';
import { useEffect, useState } from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { FeedView } from './FeedView';
import { LoginView } from './LoginView';
import { NotificationsView } from './NotificationsView';
import { ProfileView } from './ProfileView';
import { RelaysView } from './RelaysView';
import { SettingsView } from './SettingsView';
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';

type View = 'feed' | 'profile' | 'notifications' | 'relays' | 'settings';

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandPreset, setBrandPreset] = useState<NostrstackBrandPreset>('default');
  const [currentView, setCurrentView] = useState<View>('feed');

  useEffect(() => {
    // We are overriding the theme with our own CSS, but we keep this for the embedded SDK components
    applyNostrstackTheme(document.body, createNostrstackBrandTheme({ preset: brandPreset, mode: theme }));
    document.body.setAttribute('data-theme', theme);
  }, [brandPreset, theme]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        color: 'var(--color-fg-muted)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading NostrStack...
      </div>
    );
  }

  if (!pubkey) {
    return <LoginView />;
  }

  return (
    <div className="social-layout">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="feed-container">
        {currentView === 'feed' && <FeedView />}
        {currentView === 'profile' && pubkey && <ProfileView pubkey={pubkey} />}
        {currentView === 'notifications' && <NotificationsView />}
        {currentView === 'relays' && <RelaysView />}
        {currentView === 'settings' && (
          <SettingsView 
            theme={theme} 
            setTheme={setTheme} 
            brandPreset={brandPreset} 
            setBrandPreset={setBrandPreset} 
          />
        )}
      </main>
      <aside className="telemetry-sidebar">
        <ErrorBoundary fallback={<div style={{ padding: '1rem', color: '#666' }}>Telemetry Unavailable</div>}>
          <TelemetryBar />
        </ErrorBoundary>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatsProvider>
        <AppShell />
      </StatsProvider>
    </AuthProvider>
  );
}
