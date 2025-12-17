import { AuthProvider, StatsProvider,useAuth } from '@nostrstack/blog-kit';
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
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';

type View = 'feed' | 'profile' | 'notifications';

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme] = useState<'light' | 'dark'>('dark');
  const [brandPreset] = useState<NostrstackBrandPreset>('default');
  const [currentView, setCurrentView] = useState<View>('feed');

  useEffect(() => {
    applyNostrstackTheme(document.body, createNostrstackBrandTheme({ preset: brandPreset, mode: theme }));
    document.body.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--nostrstack-font-family', '"Fira Code", monospace');
  }, [brandPreset, theme]);

  if (isLoading) return <div className="loading-screen">INITIALIZING SYSTEM...</div>;

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