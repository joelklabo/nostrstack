import { AuthProvider, useAuth } from '@nostrstack/blog-kit';
import {
  applyNostrstackTheme,
  createNostrstackBrandTheme,
  type NostrstackBrandPreset,
  nostrstackBrandPresets
} from '@nostrstack/embed';
import { useEffect, useState } from 'react';

import { LoginView } from './LoginView';
import { FeedView } from './FeedView';
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [brandPreset] = useState<NostrstackBrandPreset>('default');

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
      <Sidebar />
      <main className="feed-container">
        <FeedView />
      </main>
      <aside className="telemetry-sidebar">
        <TelemetryBar />
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}