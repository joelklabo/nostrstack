import { AuthProvider, NostrstackProvider, parseRelays, StatsProvider, useAuth } from '@nostrstack/blog-kit';
import {
  applyNostrstackTheme,
  createNostrstackBrandTheme,
  type NostrstackBrandPreset
} from '@nostrstack/embed';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RelayProvider } from './context/RelayProvider';
import { DMView } from './DMView';
import { ErrorBoundary } from './ErrorBoundary';
import { FeedView } from './FeedView';
import { useKeyboardShortcuts, type View } from './hooks/useKeyboardShortcuts';
import { LoginView } from './LoginView';
import { NostrEventView } from './NostrEventView';
import { NotFoundView } from './NotFoundView';
import { NotificationsView } from './NotificationsView';
import { OffersView } from './OffersView';
import { PersonalSiteKitView } from './PersonalSiteKitView';
import { ProfileView } from './ProfileView';
import { RelaysView } from './RelaysView';
import { SearchView } from './SearchView';
import { SettingsView } from './SettingsView';
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';
import { Alert } from './ui/Alert';
import { HelpModal } from './ui/HelpModal';
import { OnboardingTour } from './ui/OnboardingTour';
import { resolveApiBase } from './utils/api-base';
import { resolveProfileRoute } from './utils/navigation';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts({ currentView, setCurrentView });

  const handleMobileMenuClose = useCallback(() => setMobileMenuOpen(false), []);
  const handleMobileMenuToggle = useCallback(() => setMobileMenuOpen(prev => !prev), []);
  const pathname = usePathname();
  const nostrRouteId = getNostrRouteId(pathname);
  const isSearchRoute = pathname === '/search' || pathname.startsWith('/search?');
  const isPersonalSiteKitRoute = pathname === '/personal-site-kit';
  const profileRoute = resolveProfileRoute(pathname);
  const profileRoutePubkey = profileRoute.pubkey;
  const profileRouteError = profileRoute.error;

  // Check if the current path is a valid route
  const isValidRoute = useMemo(() => {
    // Root is always valid
    if (pathname === '/' || pathname === '') return true;
    // Known routes
    if (isSearchRoute) return true;
    if (isPersonalSiteKitRoute) return true;
    if (nostrRouteId) return true;
    if (profileRoutePubkey) return true;
    // Profile route with error is still "handled" (shows error)
    if (pathname.startsWith('/p/')) return true;
    return false;
  }, [pathname, isSearchRoute, isPersonalSiteKitRoute, nostrRouteId, profileRoutePubkey]);

  useEffect(() => {
    if (isPersonalSiteKitRoute) {
      setCurrentView('personal-site-kit');
    }
  }, [isPersonalSiteKitRoute]);

  useEffect(() => {
    if (profileRoutePubkey) {
      setCurrentView('profile');
    }
  }, [profileRoutePubkey]);

  useEffect(() => {
    if (isSearchRoute) {
      setCurrentView('search');
      return;
    }
    if (currentView === 'search') {
      setCurrentView('feed');
    }
  }, [isSearchRoute, currentView]);

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
        height: '100dvh', 
        color: 'var(--color-fg-muted)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading NostrStack...
      </div>
    );
  }

  if (!pubkey && !isPersonalSiteKitRoute) {
    return <LoginView />;
  }

  // Show 404 for invalid routes
  if (!isValidRoute) {
    return (
      <div className="social-layout">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          mobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />
        <main className="feed-container">
          <NotFoundView />
        </main>
      </div>
    );
  }

  return (
    <div className="social-layout">
      <OnboardingTour />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Mobile hamburger button */}
      <button
        className={`hamburger-btn${mobileMenuOpen ? ' is-open' : ''}`}
        onClick={handleMobileMenuToggle}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
      >
        <span className="hamburger-icon">
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileMenuOpen ? ' is-visible' : ''}`}
        onClick={handleMobileMenuClose}
        aria-hidden="true"
      />

      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileMenuClose}
      />
      <main className="feed-container">
        {profileRouteError && (
          <Alert tone="danger" title="Routing Error">
            Invalid profile id. Showing your current view instead.
          </Alert>
        )}
        {profileRoutePubkey ? (
          <ProfileView pubkey={profileRoutePubkey} onNavigateToSettings={() => setCurrentView('settings')} />
        ) : (
          <>
            {currentView === 'feed' && <FeedView />}
            {currentView === 'search' && <SearchView />}
            {currentView === 'profile' && pubkey && <ProfileView pubkey={pubkey} onNavigateToSettings={() => setCurrentView('settings')} />}
            {currentView === 'notifications' && <NotificationsView />}
            {currentView === 'messages' && <DMView />}
            {currentView === 'relays' && <RelaysView />}
            {currentView === 'offers' && <OffersView />}
            {currentView === 'personal-site-kit' && <PersonalSiteKitView />}
            {currentView === 'settings' && (
              <SettingsView
                theme={theme}
                setTheme={setTheme}
                brandPreset={brandPreset}
                setBrandPreset={setBrandPreset}
              />
            )}
          </>
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
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' || import.meta.env.DEV;
  const relays = parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
  const envZapAddress =
    (import.meta.env.VITE_ZAP_LNURL ?? import.meta.env.VITE_ZAP_ADDRESS ?? '').trim() || undefined;
  const apiBaseForLnurl =
    apiBaseConfig.baseUrl || (/^https?:\/\//i.test(apiBase) ? apiBase.replace(/\/$/, '') : '');
  const demoLnurlAddress =
    enableRegtestPay && apiBaseForLnurl ? `${apiBaseForLnurl}/.well-known/lnurlp/alice` : undefined;
  const lnurlAddress = envZapAddress ?? demoLnurlAddress;

  return (
    <NostrstackProvider
      apiBase={apiBase}
      apiBaseConfig={apiBaseConfig}
      baseUrl={apiBase}
      relays={relays.length ? relays : undefined}
      enableRegtestPay={enableRegtestPay}
      lnAddress={lnurlAddress}
    >
      <AuthProvider>
        <RelayProvider>
          <StatsProvider>
            <AppShell />
          </StatsProvider>
        </RelayProvider>
      </AuthProvider>
    </NostrstackProvider>
  );
}
