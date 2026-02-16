import {
  AuthProvider,
  NostrstackProvider,
  parseRelays,
  StatsProvider,
  useAuth
} from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import { applyNsTheme, createNsBrandTheme, type NsBrandPreset } from '@nostrstack/widgets';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RelayProvider } from './context/RelayProvider';
import { useImmersiveScroll } from './hooks/useImmersiveScroll';
import { useKeyboardShortcuts, type View } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './layout/Sidebar';
import { TelemetryBar } from './layout/TelemetryBar';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { HelpModal } from './ui/HelpModal';
import { OnboardingTour } from './ui/OnboardingTour';
import { resolveGalleryApiBase } from './utils/api-base';
import { resolveProfileRoute } from './utils/navigation';

const FeedScreen = lazy(() =>
  import('./screens/FeedScreen').then((m) => ({ default: m.FeedScreen }))
);
const LoginScreen = lazy(() =>
  import('./screens/LoginScreen').then((m) => ({ default: m.LoginScreen }))
);
const EventDetailScreen = lazy(() =>
  import('./screens/EventDetailScreen').then((m) => ({ default: m.EventDetailScreen }))
);
const NotFoundScreen = lazy(() =>
  import('./screens/NotFoundScreen').then((m) => ({ default: m.NotFoundScreen }))
);
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const SearchScreen = lazy(() =>
  import('./screens/SearchScreen').then((m) => ({ default: m.SearchScreen }))
);
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
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

function LoadingFallback({
  message,
  includeRetry = false
}: {
  message: string;
  includeRetry?: boolean;
}) {
  return (
    <div
      className={`social-loading-state${includeRetry ? ' social-loading-state--with-retry' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="social-loading-state__message">{message}</span>
      {includeRetry && (
        <button
          type="button"
          className="social-loading-state__retry"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      )}
    </div>
  );
}

function AppShell() {
  const { pubkey, isLoading } = useAuth();
  const [theme, setThemeState] = useState<'light' | 'dark'>(getInitialTheme);
  const [brandPreset, setBrandPreset] = useState<NsBrandPreset>('default');
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const focusReturnToHamburger = useRef(false);
  const [isGuest, _setIsGuest] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('nostrstack.guest') === 'true';
  });

  // Wrap setTheme to persist to localStorage
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);
  const [currentView, setCurrentView] = useState<View>('feed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts({ currentView, setCurrentView });
  const { isImmersive } = useImmersiveScroll({
    threshold: 80,
    minDelta: 8,
    scrollContainer: '.feed-container'
  });

  const handleMobileMenuToggle = useCallback(() => setMobileMenuOpen((prev) => !prev), []);
  const closeMobileMenu = useCallback(() => {
    focusReturnToHamburger.current = true;
    setMobileMenuOpen(false);
  }, []);
  const pathname = usePathname();
  const nostrRouteId = getNostrRouteId(pathname);
  const isSearchRoute = pathname === '/search' || pathname.startsWith('/search?');
  const isSettingsRoute = pathname === '/settings' || pathname === '/settings/';
  const profileRoute = resolveProfileRoute(pathname);
  const profileRoutePubkey = profileRoute.pubkey;
  const profileRouteError = profileRoute.error;

  // Check if the current path is a valid route
  const isValidRoute = useMemo(() => {
    // Root is always valid
    if (pathname === '/' || pathname === '') return true;
    // Known routes
    if (isSearchRoute) return true;
    if (isSettingsRoute) return true;
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
    if (isSettingsRoute) {
      setCurrentView('settings');
      return;
    }
    if (isSearchRoute) {
      setCurrentView('search');
      return;
    }
    if (currentView === 'search') {
      setCurrentView('feed');
    }
  }, [isSettingsRoute, isSearchRoute, currentView]);

  useEffect(() => {
    if (mobileMenuOpen) {
      focusReturnToHamburger.current = false;
      const firstNavItem = document.querySelector<HTMLElement>(
        '.sidebar-nav .nav-item:first-child'
      );
      firstNavItem?.focus();
      return;
    }

    if (!focusReturnToHamburger.current) return;
    focusReturnToHamburger.current = false;
    if (hamburgerButtonRef.current) {
      hamburgerButtonRef.current.focus();
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    // We are overriding the theme with our own CSS, but we keep this for the embedded SDK components
    applyNsTheme(document.body, createNsBrandTheme({ preset: brandPreset, mode: theme }));
    document.body.setAttribute('data-theme', theme);
  }, [brandPreset, theme]);

  if (nostrRouteId) {
    return (
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
        <EventDetailScreen rawId={nostrRouteId} />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <main className="feed-container social-loading-main" id="main-content" role="main">
        <LoadingFallback message="Loading NostrStack..." includeRetry />
      </main>
    );
  }

  if (!pubkey && !isGuest) {
    return (
      <main className="feed-container" id="main-content" role="main">
        <Suspense fallback={<LoadingFallback message="Loading..." includeRetry />}>
          <LoginScreen />
        </Suspense>
      </main>
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
          onMobileClose={closeMobileMenu}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <main className="feed-container" id="main-content" role="main">
          <NotFoundScreen />
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
        ref={hamburgerButtonRef}
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
      <button
        type="button"
        className={`sidebar-overlay${mobileMenuOpen ? ' is-visible' : ''}`}
        tabIndex={mobileMenuOpen ? 0 : -1}
        aria-label="Close mobile menu"
        aria-hidden={!mobileMenuOpen}
        onClick={closeMobileMenu}
        disabled={!mobileMenuOpen}
      >
        <span className="sr-only">Close mobile menu</span>
      </button>

      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        mobileOpen={mobileMenuOpen}
        onMobileClose={closeMobileMenu}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <main className="feed-container" id="main-content" role="main">
        <Suspense fallback={<LoadingFallback message="Loading..." includeRetry />}>
          {profileRouteError && (
            <Alert tone="danger" title="Routing Error">
              Invalid profile id. Showing your current view instead.
            </Alert>
          )}
          {profileRoutePubkey ? (
            <ProfileScreen
              pubkey={profileRoutePubkey}
              onNavigateToSettings={() => setCurrentView('settings')}
            />
          ) : (
            <>
              {currentView === 'feed' && <FeedScreen isImmersive={isImmersive} />}
              {currentView === 'search' && <SearchScreen />}
              {currentView === 'profile' && pubkey && (
                <ProfileScreen
                  pubkey={pubkey}
                  onNavigateToSettings={() => setCurrentView('settings')}
                />
              )}
              {currentView === 'settings' && (
                <SettingsScreen
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
      <aside className="telemetry-sidebar">
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
  const apiBaseConfig = resolveGalleryApiBase({
    apiBase: import.meta.env.VITE_API_BASE_URL
  });
  const apiBase = apiBaseConfig.baseUrl;
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;
  const relays = parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
  const envZapAddress =
    (
      import.meta.env.VITE_ZAP_LNURL ??
      import.meta.env.VITE_ZAP_ADDRESS ??
      import.meta.env.VITE_NOSTRSTACK_TIP_LNADDR ??
      ''
    ).trim() || undefined;
  const apiBaseForLnurl =
    apiBase && /^https?:\/\//i.test(apiBase) ? apiBase.replace(/\/$/, '') : '';
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
