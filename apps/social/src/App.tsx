import {
  AuthProvider,
  NostrstackProvider,
  parseRelays,
  StatsProvider,
  useAuth
} from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import {
  applyNsTheme,
  createNsBrandTheme,
  type NsBrandPreset,
  nsBrandPresets
} from '@nostrstack/widgets';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RelayProvider } from './context/RelayProvider';
import { useImmersiveScroll } from './hooks/useImmersiveScroll';
import { useKeyboardShortcuts, type View } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './layout/Sidebar';
import { TelemetryBar } from './layout/TelemetryBar';
import { relayMonitor, type RelayStats } from './nostr/relayHealth';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { HelpModal } from './ui/HelpModal';
import { OnboardingTour } from './ui/OnboardingTour';
import { type ApiBaseResolution, resolveGalleryApiBase } from './utils/api-base';
import { navigateTo, resolveProfileRoute } from './utils/navigation';
const LoginScreen = lazy(() =>
  import('./screens/LoginScreen')
    .then((m) => ({ default: m.LoginScreen }))
    .catch((error) => {
      console.error('Failed to load login route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load the login screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen')
    .then((m) => ({ default: m.ProfileScreen }))
    .catch((error) => {
      console.error('Failed to load profile route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load the profile screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const EventDetailScreen = lazy(() =>
  import('./screens/EventDetailScreen')
    .then((m) => ({ default: m.EventDetailScreen }))
    .catch((error) => {
      console.error('Failed to load event route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load the event screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const loadSettingsScreen = () =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }));
const NotFoundScreen = lazy(() =>
  import('./screens/NotFoundScreen')
    .then((m) => ({ default: m.NotFoundScreen }))
    .catch((error) => {
      console.error('Failed to load not found route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load fallback screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const loadOffersView = () => import('./OffersView').then((m) => ({ default: m.OffersView }));
const SearchScreen = lazy(() =>
  import('./screens/SearchScreen')
    .then((m) => ({ default: m.SearchScreen }))
    .catch((error) => {
      console.error('Failed to load search route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load the search screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const RelaysView = lazy(() =>
  import('./RelaysView')
    .then((m) => ({ default: m.RelaysView }))
    .catch((error) => {
      console.error('Failed to load relays route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load relays management screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);
const FeedScreen = lazy(() =>
  import('./screens/FeedScreen')
    .then((m) => ({ default: m.FeedScreen }))
    .catch((error) => {
      console.error('Failed to load feed route module.', error);
      return {
        default: () => (
          <RouteLoadFallback
            message="Unable to load the feed screen. Please try reloading."
            onRetry={() => window.location.reload()}
          />
        )
      };
    })
);

function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`
  );

  useEffect(() => {
    const handle = () => setPathname(`${window.location.pathname}${window.location.search}`);
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
const BRAND_PRESET_STORAGE_KEY = 'nostrstack.brandPreset';
const BRAND_PRESET_DEFAULT: NsBrandPreset = 'default';
const BRAND_PRESET_LIST: NsBrandPreset[] = Object.keys(nsBrandPresets) as NsBrandPreset[];
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LOCAL_API_TIMEOUT_MS = 3_000;
const LOCAL_API_BASE_FALLBACK = '/api';
const RELAY_DEGRADED_WINDOW_MS = 5 * 60_000;
const LOCAL_API_UNAVAILABLE: ApiBaseResolution = {
  raw: '',
  baseUrl: '',
  isConfigured: false,
  isMock: false,
  isRelative: false
};

function isLocalApiBase(apiBase: ApiBaseResolution): boolean {
  if (!apiBase.baseUrl || apiBase.isRelative || !apiBase.isConfigured || apiBase.isMock)
    return false;
  try {
    const parsed = new URL(apiBase.baseUrl);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOCAL_API_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function shouldProbeProxyForLocalApi(apiBase: ApiBaseResolution): boolean {
  if (window.location.protocol !== 'https:') return false;
  if (!isLocalApiBase(apiBase) || !apiBase.baseUrl) return false;
  try {
    const parsed = new URL(apiBase.baseUrl);
    return parsed.protocol === 'http:' && LOCAL_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

const FALLBACK_API_BASE = resolveGalleryApiBase({ apiBase: LOCAL_API_BASE_FALLBACK });

function isBrandPreset(value: string | null): value is NsBrandPreset {
  return value !== null && (BRAND_PRESET_LIST as readonly string[]).includes(value);
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Respect system preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function getInitialBrandPreset(): NsBrandPreset {
  if (typeof window === 'undefined') return BRAND_PRESET_DEFAULT;
  const stored = localStorage.getItem(BRAND_PRESET_STORAGE_KEY);
  return isBrandPreset(stored) ? stored : BRAND_PRESET_DEFAULT;
}

function hasRecentRelayFailures(now: number = Date.now()) {
  const inMemoryStats = Object.values(relayMonitor.getStatsSnapshot()) as RelayStats[];
  let persistedStats: RelayStats[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('nostrstack.relayStats.v2');
      if (raw) {
        persistedStats = Object.values(JSON.parse(raw) as Record<string, RelayStats>);
      }
    } catch {
      // Ignore invalid persisted relay stats.
    }
  }

  return [...inMemoryStats, ...persistedStats].some((entry) => {
    if (!entry.lastFailureAt || entry.consecutiveFailures < 1) return false;
    return now - entry.lastFailureAt < RELAY_DEGRADED_WINDOW_MS;
  });
}

function LoadingFallback({
  message,
  includeRetry = false,
  retryLabel = 'Retry',
  onRetry
}: {
  message: string;
  includeRetry?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? (() => window.location.reload());

  return (
    <div
      className={`social-loading-state${includeRetry ? ' social-loading-state--with-retry' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="social-loading-state__message">{message}</span>
      {includeRetry && (
        <button type="button" className="social-loading-state__retry" onClick={handleRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

function RouteLoadFallback({
  message,
  onRetry,
  retryLabel = 'Reload page',
  onNavigateHome,
  homeLabel = 'Go to feed'
}: {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onNavigateHome?: () => void;
  homeLabel?: string;
}) {
  return (
    <div style={{ padding: '1.5rem', color: 'var(--ns-color-text)' }}>
      <Alert tone="danger" style={{ marginBottom: '1rem' }} role="alert">
        {message ?? 'Unable to load this route. Please try reloading.'}
      </Alert>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ns-btn ns-btn--primary"
          onClick={onRetry ?? (() => window.location.reload())}
        >
          {retryLabel}
        </button>
        <button
          type="button"
          className="ns-btn ns-btn--ghost"
          onClick={onNavigateHome ?? (() => navigateTo('/'))}
        >
          {homeLabel}
        </button>
      </div>
    </div>
  );
}

function AppShell({ onRetryLocalApi }: { onRetryLocalApi?: () => void }) {
  const { pubkey, isLoading, logout: authLogout } = useAuth();
  const [theme, setThemeState] = useState<'light' | 'dark'>(getInitialTheme);
  const [brandPreset, setBrandPresetState] = useState<NsBrandPreset>(getInitialBrandPreset);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const focusReturnToHamburger = useRef(false);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('nostrstack.guest') === 'true';
  });
  const [routeRecoveryKey, setRouteRecoveryKey] = useState(0);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('nostrstack.guest');
    setIsGuest(false);
    authLogout();
  }, [authLogout]);

  // Wrap setTheme to persist to localStorage
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  const setBrandPreset = useCallback((newPreset: NsBrandPreset) => {
    setBrandPresetState(newPreset);
    if (typeof window === 'undefined') return;
    localStorage.setItem(BRAND_PRESET_STORAGE_KEY, newPreset);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        if (event.newValue === 'light' || event.newValue === 'dark') {
          setThemeState(event.newValue);
        }
        return;
      }

      if (event.key === BRAND_PRESET_STORAGE_KEY) {
        setBrandPresetState(isBrandPreset(event.newValue) ? event.newValue : BRAND_PRESET_DEFAULT);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
  const retryCurrentRoute = useCallback(() => {
    setRouteRecoveryKey((value) => value + 1);
  }, []);
  const retryRouteAndHealthCheck = useCallback(() => {
    onRetryLocalApi?.();
    retryCurrentRoute();
  }, [onRetryLocalApi, retryCurrentRoute]);
  const routeLocation = usePathname();
  const pathname = routeLocation.split('?')[0] || '/';
  const routeRecoveryIdentity = routeLocation;
  const SettingsScreen = useMemo(() => lazy(loadSettingsScreen), []);
  const OffersView = useMemo(() => lazy(loadOffersView), []);
  const isRouteWithOptionalQuery = (path: string) =>
    pathname === path ||
    pathname === `${path}/` ||
    pathname.startsWith(`${path}?`) ||
    pathname.startsWith(`${path}/?`);
  const isDemoRoute = pathname === '/demo' || pathname === '/demo/';
  const nostrRouteId = getNostrRouteId(pathname);
  const isSearchRoute = isRouteWithOptionalQuery('/search');
  const isFindFriendRoute = isRouteWithOptionalQuery('/find-friend');
  const isRelaysRoute = isRouteWithOptionalQuery('/relays');
  const isSettingsRoute = pathname === '/settings' || pathname === '/settings/';
  const isOffersRoute = pathname === '/offers' || pathname === '/offers/';
  const retryFailedRoute = useCallback(() => {
    if (isSettingsRoute || isOffersRoute) {
      window.location.reload();
      return;
    }
    retryRouteAndHealthCheck();
  }, [isOffersRoute, isSettingsRoute, retryRouteAndHealthCheck]);
  const isGuestProfileRoute = isRouteWithOptionalQuery('/profile');
  const profileRoute = resolveProfileRoute(pathname);
  const profileRoutePubkey = profileRoute.pubkey;
  const profileRouteError = profileRoute.error;
  const isProfileRoute = isGuestProfileRoute || pathname.startsWith('/p/');
  const previousPathRef = useRef(pathname);
  const routeBoundView = useMemo<View>(() => {
    if (isProfileRoute || profileRoutePubkey) {
      return 'profile';
    }
    if (isSettingsRoute) {
      return 'settings';
    }
    if (isOffersRoute) {
      return 'offers';
    }
    if (isSearchRoute || isFindFriendRoute) {
      return 'search';
    }
    return currentView;
  }, [
    currentView,
    isProfileRoute,
    isSettingsRoute,
    isOffersRoute,
    isSearchRoute,
    isFindFriendRoute,
    profileRoutePubkey
  ]);
  const handleNavigateToSettings = useCallback(() => {
    navigateTo('/settings');
    setCurrentView('settings');
  }, [setCurrentView]);

  // Check if the current path is a valid route
  const isValidRoute = useMemo(() => {
    // Root is always valid
    if (pathname === '/' || pathname === '') return true;
    // Known routes
    if (isDemoRoute) return true;
    if (isSearchRoute) return true;
    if (isFindFriendRoute) return true;
    if (isRelaysRoute) return true;
    if (isSettingsRoute) return true;
    if (isOffersRoute) return true;
    if (isProfileRoute) return true;
    if (nostrRouteId) return true;
    if (profileRoutePubkey) return true;
    // Profile route with error is still "handled" (shows error)
    if (pathname.startsWith('/p/')) return true;
    return false;
  }, [
    pathname,
    isDemoRoute,
    isSearchRoute,
    isFindFriendRoute,
    isRelaysRoute,
    isSettingsRoute,
    isOffersRoute,
    isProfileRoute,
    nostrRouteId,
    profileRoutePubkey
  ]);

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
    if (isOffersRoute) {
      setCurrentView('offers');
      return;
    }
    if (isSearchRoute || isFindFriendRoute) {
      setCurrentView('search');
      return;
    }
    if (isProfileRoute) {
      setCurrentView('profile');
      return;
    }
    if (currentView !== 'feed') {
      setCurrentView('feed');
    }
  }, [
    currentView,
    isOffersRoute,
    isSearchRoute,
    isFindFriendRoute,
    isSettingsRoute,
    profileRoutePubkey,
    isProfileRoute
  ]);

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

  useEffect(() => {
    const body = document.body;
    if (mobileMenuOpen) {
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      body.classList.add('is-mobile-menu-open');
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
      body.classList.remove('is-mobile-menu-open');
    }

    return () => {
      body.style.overflow = '';
      body.style.paddingRight = '';
      body.classList.remove('is-mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      previousPathRef.current = pathname;
      return;
    }
    if (previousPathRef.current !== pathname) {
      setMobileMenuOpen(false);
      return;
    }
    previousPathRef.current = pathname;
  }, [mobileMenuOpen, pathname]);

  const relayConnectivityDegraded = hasRecentRelayFailures();

  if (nostrRouteId) {
    return (
      <ErrorBoundary
        key={`${routeRecoveryIdentity}-${routeRecoveryKey}`}
        resetToken={routeRecoveryKey}
        fallback={
          <RouteLoadFallback
            message="Unable to load event screen. Please try reloading."
            onRetry={retryRouteAndHealthCheck}
            retryLabel="Retry route"
          />
        }
      >
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
          <EventDetailScreen rawId={nostrRouteId} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <main className="feed-container social-loading-main" id="main-content" role="main">
        <LoadingFallback message="Loading NostrStack..." />
      </main>
    );
  }

  if (!pubkey && !isGuest) {
    return (
      <main className="feed-container" id="main-content" role="main">
        {relayConnectivityDegraded && (
          <Alert
            tone="warning"
            title="Relay connectivity degraded"
            style={{ marginBottom: '1rem' }}
          >
            Some relay/WebSocket connections are failing. Wallet funding and publish actions may be
            delayed or fail until relays recover. Check your relay settings in the Relays view.
          </Alert>
        )}
        <ErrorBoundary
          key={`${routeRecoveryIdentity}-${routeRecoveryKey}`}
          resetToken={routeRecoveryKey}
          fallback={
            <RouteLoadFallback
              message="Unable to load the login screen. Please try reloading."
              onRetry={retryRouteAndHealthCheck}
              retryLabel="Retry route"
            />
          }
        >
          <Suspense fallback={<LoadingFallback message="Loading login screen..." />}>
            <LoginScreen />
          </Suspense>
        </ErrorBoundary>
      </main>
    );
  }

  // Show 404 for invalid routes
  if (!isValidRoute) {
    return (
      <div className="social-layout">
        <Sidebar
          currentView={routeBoundView}
          setCurrentView={setCurrentView}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
          onOpenHelp={() => setHelpOpen(true)}
          onLogout={handleLogout}
          isGuest={isGuest}
        />
        <main className="feed-container" id="main-content" role="main">
          <ErrorBoundary
            key={`${routeRecoveryIdentity}-${routeRecoveryKey}`}
            resetToken={routeRecoveryKey}
            fallback={
              <RouteLoadFallback
                message="Unable to load fallback screen. Please try reloading."
                onRetry={retryRouteAndHealthCheck}
                retryLabel="Retry route"
              />
            }
          >
            <Suspense fallback={<LoadingFallback message="Loading fallback screen..." />}>
              <NotFoundScreen />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  if (isDemoRoute) {
    return (
      <div className={`social-layout${isImmersive ? ' is-immersive' : ''}`}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary fallback={null}>
          <OnboardingTour />
        </ErrorBoundary>
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
          hidden={!mobileMenuOpen}
          tabIndex={mobileMenuOpen ? 0 : -1}
          aria-label="Close mobile menu"
          aria-hidden={!mobileMenuOpen}
          onClick={closeMobileMenu}
          disabled={!mobileMenuOpen}
        >
          <span className="sr-only">Close mobile menu</span>
        </button>

        <Sidebar
          currentView={routeBoundView}
          setCurrentView={setCurrentView}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
          onOpenHelp={() => setHelpOpen(true)}
          onLogout={handleLogout}
          isGuest={isGuest}
        />
        <main className="feed-container" id="main-content" role="main">
          <section className="nostr-event-card">
            <div className="nostr-event-section-title" style={{ marginBottom: '1rem' }}>
              Demo mode
            </div>
            <p className="ns-content">
              Open this page to inspect Bitcoin status and live network telemetry in a public
              context.
            </p>
          </section>
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

  return (
    <div className={`social-layout${isImmersive ? ' is-immersive' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ErrorBoundary fallback={null}>
        <OnboardingTour />
      </ErrorBoundary>
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
        hidden={!mobileMenuOpen}
        tabIndex={mobileMenuOpen ? 0 : -1}
        aria-label="Close mobile menu"
        aria-hidden={!mobileMenuOpen}
        onClick={closeMobileMenu}
        disabled={!mobileMenuOpen}
      >
        <span className="sr-only">Close mobile menu</span>
      </button>

      <Sidebar
        currentView={routeBoundView}
        setCurrentView={setCurrentView}
        mobileOpen={mobileMenuOpen}
        onMobileClose={closeMobileMenu}
        onOpenHelp={() => setHelpOpen(true)}
        onLogout={handleLogout}
        isGuest={isGuest}
      />
      <main className="feed-container" id="main-content" role="main">
        {relayConnectivityDegraded && (
          <Alert
            tone="warning"
            title="Relay connectivity degraded"
            style={{ marginBottom: '1rem' }}
          >
            Some relay/WebSocket connections are failing. Wallet funding and publish actions may be
            delayed or fail until relays recover. Check your relay settings in the Relays view.
          </Alert>
        )}
        <ErrorBoundary
          key={`${routeRecoveryIdentity}-${routeRecoveryKey}`}
          resetToken={routeRecoveryKey}
          fallback={
            <RouteLoadFallback
              message={
                isSettingsRoute
                  ? 'Unable to load the settings screen. Please try reloading.'
                  : isOffersRoute
                    ? 'Unable to load the offers screen. Please try reloading.'
                    : 'Unable to load this route. Please try reloading.'
              }
              onRetry={retryFailedRoute}
              retryLabel={isSettingsRoute || isOffersRoute ? 'Reload page' : 'Retry route'}
            />
          }
        >
          <Suspense
            key={`${routeRecoveryIdentity}-${routeRecoveryKey}`}
            fallback={<LoadingFallback message={`Loading ${routeBoundView} route...`} />}
          >
            {isRelaysRoute ? (
              <RelaysView />
            ) : isProfileRoute ? (
              <>
                {profileRouteError && (
                  <Alert tone="danger" title="Routing Error">
                    Invalid profile id. Showing your current view instead.
                  </Alert>
                )}
                {profileRoutePubkey ? (
                  <ProfileScreen
                    pubkey={profileRoutePubkey}
                    onNavigateToSettings={handleNavigateToSettings}
                  />
                ) : pubkey ? (
                  <ProfileScreen pubkey={pubkey} onNavigateToSettings={handleNavigateToSettings} />
                ) : (
                  <div className="profile-guest-placeholder">
                    <p>Sign in to view your profile</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {routeBoundView === 'feed' && <FeedScreen isImmersive={isImmersive} />}
                {routeBoundView === 'search' && <SearchScreen />}
                {routeBoundView === 'offers' && <OffersView />}
                {routeBoundView === 'settings' && (
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
        </ErrorBoundary>
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
  const [resolvedApiBaseConfig, setResolvedApiBaseConfig] =
    useState<ApiBaseResolution>(apiBaseConfig);
  const [localApiCheckFailed, setLocalApiCheckFailed] = useState(false);
  const [isResolvingLocalApiBase, setIsResolvingLocalApiBase] = useState(() =>
    isLocalApiBase(apiBaseConfig)
  );
  const initialLocalApiConfig = useRef<ApiBaseResolution | null>(
    isLocalApiBase(apiBaseConfig) ? apiBaseConfig : null
  );
  const probedBasesRef = useRef<Set<string>>(new Set());

  const retryLocalApiHealthCheck = useCallback(() => {
    if (!initialLocalApiConfig.current) {
      return;
    }
    setResolvedApiBaseConfig(initialLocalApiConfig.current);
    setLocalApiCheckFailed(false);
    setIsResolvingLocalApiBase(true);
  }, []);

  useEffect(() => {
    if (!isResolvingLocalApiBase) {
      return;
    }
    if (!isLocalApiBase(resolvedApiBaseConfig)) {
      setIsResolvingLocalApiBase(false);
      return;
    }
    const baseKey = resolvedApiBaseConfig.baseUrl;
    if (probedBasesRef.current.has(baseKey)) {
      setIsResolvingLocalApiBase(false);
      return;
    }
    probedBasesRef.current.add(baseKey);
    let isMounted = true;

    const checkApiHealth = async (url: string): Promise<boolean> => {
      let timeoutHandle: number | null = null;
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutHandle = window.setTimeout(() => resolve(null), LOCAL_API_TIMEOUT_MS);
      });
      try {
        const response = await Promise.race([fetch(`${url}/api/health`), timeoutPromise]);
        return !!response && response.ok;
      } catch {
        return false;
      } finally {
        if (timeoutHandle !== null) {
          window.clearTimeout(timeoutHandle);
        }
      }
    };

    const probe = async () => {
      const shouldUseProxyFallback = shouldProbeProxyForLocalApi(resolvedApiBaseConfig);
      const primaryBase = shouldUseProxyFallback ? FALLBACK_API_BASE : resolvedApiBaseConfig;
      const primaryHealthCheckWorks = await checkApiHealth(primaryBase.baseUrl);

      if (primaryHealthCheckWorks) {
        if (shouldUseProxyFallback && isMounted) {
          setResolvedApiBaseConfig(FALLBACK_API_BASE);
        }
      } else if (shouldUseProxyFallback) {
        if (isMounted) {
          setLocalApiCheckFailed(true);
          setResolvedApiBaseConfig((current) =>
            isLocalApiBase(current) ? LOCAL_API_UNAVAILABLE : current
          );
        }
      } else {
        const fallbackWorks = await checkApiHealth(FALLBACK_API_BASE.baseUrl);

        if (fallbackWorks) {
          if (isMounted) {
            setResolvedApiBaseConfig(FALLBACK_API_BASE);
          }
        } else {
          if (isMounted) {
            setLocalApiCheckFailed(true);
            setResolvedApiBaseConfig((current) =>
              isLocalApiBase(current) ? LOCAL_API_UNAVAILABLE : current
            );
          }
        }
      }

      if (isMounted) {
        setIsResolvingLocalApiBase(false);
      }
    };

    void probe();
    return () => {
      isMounted = false;
    };
  }, [resolvedApiBaseConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const apiBase = resolvedApiBaseConfig.baseUrl;
  if (localApiCheckFailed) {
    console.warn('Social API health check failed; continuing with fallback API configuration.');
  }
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
      apiBaseConfig={resolvedApiBaseConfig}
      baseUrl={apiBase}
      relays={relays.length ? relays : undefined}
      onRelayFailure={relayMonitor.reportFailure.bind(relayMonitor)}
      enableRegtestPay={enableRegtestPay}
      lnAddress={lnurlAddress}
    >
      <AuthProvider>
        <RelayProvider>
          <StatsProvider>
            <AppShell onRetryLocalApi={retryLocalApiHealthCheck} />
          </StatsProvider>
        </RelayProvider>
      </AuthProvider>
    </NostrstackProvider>
  );
}
