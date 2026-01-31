import {
  AuthProvider,
  NostrstackProvider,
  parseRelays,
  StatsProvider,
  useAuth
} from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import { applyNsTheme, createNsBrandTheme, type NsBrandPreset } from '@nostrstack/widgets';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { RelayProvider } from './context/RelayProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { useImmersiveScroll } from './hooks/useImmersiveScroll';
import { useKeyboardShortcuts, type View } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './Sidebar';
import { TelemetryBar } from './TelemetryBar';
import { HelpModal } from './ui/HelpModal';
import { OnboardingTour } from './ui/OnboardingTour';
import { resolveApiBase } from './utils/api-base';
import { resolveProfileRoute } from './utils/navigation';

const DMView = lazy(() => import('./DMView').then((m) => ({ default: m.DMView })));
const FeedView = lazy(() => import('./FeedView').then((m) => ({ default: m.FeedView })));
const LoginView = lazy(() => import('./LoginView').then((m) => ({ default: m.LoginView })));
const NostrEventView = lazy(() =>
  import('./NostrEventView').then((m) => ({ default: m.NostrEventView }))
);
const NotFoundView = lazy(() =>
  import('./NotFoundView').then((m) => ({ default: m.NotFoundView }))
);
const NotificationsView = lazy(() =>
  import('./NotificationsView').then((m) => ({ default: m.NotificationsView }))
);
const OffersView = lazy(() => import('./OffersView').then((m) => ({ default: m.OffersView })));
const ProfileView = lazy(() => import('./ProfileView').then((m) => ({ default: m.ProfileView })));
const RelaysView = lazy(() => import('./RelaysView').then((m) => ({ default: m.RelaysView })));
const SearchView = lazy(() => import('./SearchView').then((m) => ({ default: m.SearchView })));
const SettingsView = lazy(() =>
  import('./SettingsView').then((m) => ({ default: m.SettingsView }))
);

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

const THEME_STORAGE_KEY = 'nostrstack.theme';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Respect system preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme, setThemeState] = useState<'light' | 'dark'>(getInitialTheme);
  const [brandPreset, setBrandPreset] = useState<NsBrandPreset>('default');

  // Wrap setTheme to persist to localStorage
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);
  const [currentView, setCurrentView] = useState<View>('feed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts({ currentView, setCurrentView });
  const { isImmersive } = useImmersiveScroll({ threshold: 80, minDelta: 8 });

  const handleMobileMenuClose = useCallback(() => setMobileMenuOpen(false), []);
  const handleMobileMenuToggle = useCallback(() => setMobileMenuOpen((prev) => !prev), []);
  const pathname = usePathname();
  const nostrRouteId = getNostrRouteId(pathname);
  const isSearchRoute = pathname === '/search' || pathname.startsWith('/search?');
  const profileRoute = resolveProfileRoute(pathname);
  const profileRoutePubkey = profileRoute.pubkey;
  const profileRouteError = profileRoute.error;

  // Check if the current path is a valid route
  const isValidRoute = useMemo(() => {
    // Root is always valid
    if (pathname === '/' || pathname === '') return true;
    // Known routes
    if (isSearchRoute) return true;
    if (nostrRouteId) return true;
    if (profileRoutePubkey) return true;
    // Profile route with error is still "handled" (shows error)
    if (pathname.startsWith('/p/')) return true;
    return false;
  }, [pathname, isSearchRoute, nostrRouteId, profileRoutePubkey]);

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
    applyNsTheme(document.body, createNsBrandTheme({ preset: brandPreset, mode: theme }));
    document.body.setAttribute('data-theme', theme);
  }, [brandPreset, theme]);

  if (nostrRouteId) {
    return (
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
        <NostrEventView rawId={nostrRouteId} />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100dvh',
          color: 'var(--ns-color-text-muted)',
          fontFamily: 'var(--ns-font-family-sans)'
        }}
      >
        Loading NostrStack...
      </div>
    );
  }

  if (!pubkey) {
    return (
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
        <LoginView />
      </Suspense>
    );
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
          onOpenHelp={() => setHelpOpen(true)}
        />
        <main className="feed-container" id="main-content">
          <NotFoundView />
        </main>
      </div>
    );
  }

  return (
    <div className={`social-layout${isImmersive ? ' is-immersive' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <OnboardingTour />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Mobile hamburger button */}
      <button
        type="button"
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
        role="button"
        tabIndex={mobileMenuOpen ? 0 : -1}
        aria-label="Close menu"
        aria-hidden={!mobileMenuOpen}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          handleMobileMenuClose();
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleMobileMenuClose();
          }
        }}
      />

      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileMenuClose}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <main className="feed-container" id="main-content">
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '2rem',
                color: 'var(--ns-color-text-muted)'
              }}
            >
              Loading...
            </div>
          }
        >
          {profileRouteError && (
            <Alert tone="danger" title="Routing Error">
              Invalid profile id. Showing your current view instead.
            </Alert>
          )}
          {profileRoutePubkey ? (
            <ProfileView
              pubkey={profileRoutePubkey}
              onNavigateToSettings={() => setCurrentView('settings')}
            />
          ) : (
            <>
              {currentView === 'feed' && <FeedView isImmersive={isImmersive} />}
              {currentView === 'search' && <SearchView />}
              {currentView === 'profile' && pubkey && (
                <ProfileView
                  pubkey={pubkey}
                  onNavigateToSettings={() => setCurrentView('settings')}
                />
              )}
              {currentView === 'notifications' && <NotificationsView />}
              {currentView === 'messages' && <DMView />}
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
            </>
          )}
        </Suspense>
      </main>
      <aside
        className="telemetry-sidebar"
        inert={isImmersive || undefined}
        aria-hidden={isImmersive || undefined}
      >
        <ErrorBoundary
          fallback={
            <div style={{ padding: '1rem', color: 'var(--ns-color-text-muted)' }}>
              Telemetry Unavailable
            </div>
          }
        >
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
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;
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
