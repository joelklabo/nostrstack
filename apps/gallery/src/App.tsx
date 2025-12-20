import { AuthProvider, NostrstackProvider, parseRelays, StatsProvider, useAuth } from '@nostrstack/blog-kit';
import {
  applyNostrstackTheme,
  createNostrstackBrandTheme,
  type NostrstackBrandPreset
} from '@nostrstack/embed';
import { useEffect, useState } from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { FeedView } from './FeedView';
import { LoginView } from './LoginView';
import { NostrEventView } from './NostrEventView';
import { NotificationsView } from './NotificationsView';
import { OffersView } from './OffersView';
import { ProfileView } from './ProfileView';
import { RelaysView } from './RelaysView';
import { SettingsView } from './SettingsView';
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';
import { resolveApiBase } from './utils/api-base';

type View = 'feed' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings';

function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname
  );

  useEffect(() => {
    const handle = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, []);

  return pathname;
}

function getNostrRouteId(pathname: string) {
  const match = pathname.match(/^\/nostr\/([^/?#]+)/i);
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match[1]);
    return raw.replace(/^nostr:/i, '');
  } catch {
    return match[1];
  }
}

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandPreset, setBrandPreset] = useState<NostrstackBrandPreset>('default');
  const [currentView, setCurrentView] = useState<View>('feed');
  const pathname = usePathname();
  const nostrRouteId = getNostrRouteId(pathname);

  useEffect(() => {
    // We are overriding the theme with our own CSS, but we keep this for the embedded SDK components
    applyNostrstackTheme(document.body, createNostrstackBrandTheme({ preset: brandPreset, mode: theme }));
    document.body.setAttribute('data-theme', theme);
  }, [brandPreset, theme]);

  if (nostrRouteId) {
    return <NostrEventView rawId={nostrRouteId} />;
  }

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
        {currentView === 'offers' && <OffersView />}
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
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const apiBaseConfig = resolveApiBase(apiBase);
  const enableRegtestPay = String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true';
  const relays = parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);

  return (
    <NostrstackProvider
      apiBase={apiBase}
      apiBaseConfig={apiBaseConfig}
      baseUrl={apiBase}
      relays={relays.length ? relays : undefined}
      enableRegtestPay={enableRegtestPay}
    >
      <AuthProvider>
        <StatsProvider>
          <AppShell />
        </StatsProvider>
      </AuthProvider>
    </NostrstackProvider>
  );
}
