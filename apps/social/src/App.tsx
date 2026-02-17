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
import { relayMonitor } from './nostr/relayHealth';
import { SearchScreen } from './screens/SearchScreen';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { HelpModal } from './ui/HelpModal';
import { OnboardingTour } from './ui/OnboardingTour';
import { type ApiBaseResolution, resolveGalleryApiBase } from './utils/api-base';
import { navigateTo, resolveProfileRoute } from './utils/navigation';

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
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const OffersView = lazy(() => import('./OffersView').then((m) => ({ default: m.OffersView })));

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
const BRAND_PRESET_STORAGE_KEY = 'nostrstack.brandPreset';
const BRAND_PRESET_DEFAULT: NsBrandPreset = 'default';
const BRAND_PRESET_LIST: NsBrandPreset[] = Object.keys(nsBrandPresets) as NsBrandPreset[];
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LOCAL_API_TIMEOUT_MS = 3_000;
const LOCAL_API_BASE_FALLBACK = '/api';

function isLocalApiBase(apiBase: ApiBaseResolution): boolean {
  if (!apiBase.baseUrl || apiBase.isRelative || !apiBase.isConfigured || apiBase.isMock)
    return false;
  try {
    const parsed = new URL(apiBase.baseUrl);
    return (
      parsed.protocol === 'http:' && parsed.port === '3001' && LOCAL_API_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function buildApiBaseFallback(): ApiBaseResolution {
  return resolveGalleryApiBase({ apiBase: LOCAL_API_BASE_FALLBACK });
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

function AppShell() {
  const { pubkey, isLoading, logout: authLogout } = useAuth();
  const [theme, setThemeState] = useState<'light' | 'dark'>(getInitialTheme);
  const [brandPreset, setBrandPresetState] = useState<NsBrandPreset>(getInitialBrandPreset);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const focusReturnToHamburger = useRef(false);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('nostrstack.guest') === 'true';
  });

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
  const pathname = usePathname();
  const isRouteWithOptionalQuery = (path: string) =>
    pathname === path ||
    pathname === `${path}/` ||
    pathname.startsWith(`${path}?`) ||
    pathname.startsWith(`${path}/?`);
  const isDemoRoute = pathname === '/demo' || pathname === '/demo/';
  const nostrRouteId = getNostrRouteId(pathname);
  const isSearchRoute = isRouteWithOptionalQuery('/search');
  const isFindFriendRoute = isRouteWithOptionalQuery('/find-friend');
  const isSettingsRoute = pathname === '/settings' || pathname === '/settings/';
  const isOffersRoute = pathname === '/offers' || pathname === '/offers/';
  const isGuestProfileRoute = pathname === '/profile';
  const profileRoute = resolveProfileRoute(pathname);
  const profileRoutePubkey = profileRoute.pubkey;
  const profileRouteError = profileRoute.error;
  const previousPathRef = useRef(pathname);
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
    if (isSettingsRoute) return true;
    if (isOffersRoute) return true;
    if (pathname === '/profile') return true;
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
    isSettingsRoute,
    isOffersRoute,
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
    if (profileRoutePubkey || isGuestProfileRoute) {
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
    isGuestProfileRoute
  ]);

  useEffect(() => {
    const root = typeof document === 'undefined' ? null : document;
    if (!root) return;

    const markMediaImages = (node: ParentNode = root) => {
      Array.from(node.querySelectorAll('.nostr-media-img:not(.ns-content__image)')).forEach(
        (img) => {
          img.classList.add('ns-content__image');
        }
      );
      if ((node as HTMLElement).classList?.contains('nostr-media-img')) {
        (node as HTMLElement).classList.add('ns-content__image');
      }
    };

    markMediaImages();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          markMediaImages(node);
        });
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

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
        <LoadingFallback message="Loading NostrStack..." />
      </main>
    );
  }

  if (!pubkey && !isGuest) {
    return (
      <main className="feed-container" id="main-content" role="main">
        <Suspense
          fallback={
            <LoadingFallback message="Loading..." includeRetry retryLabel="Retry sign-in screen" />
          }
        >
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
          onLogout={handleLogout}
        />
        <main className="feed-container" id="main-content" role="main">
          <NotFoundScreen />
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
          onLogout={handleLogout}
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
        onLogout={handleLogout}
      />
      <main className="feed-container" id="main-content" role="main">
        <Suspense
          fallback={
            <LoadingFallback
              message={`Loading ${currentView} route...`}
              includeRetry
              retryLabel="Retry current route"
            />
          }
        >
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
          ) : (
            <>
              {currentView === 'feed' && <FeedScreen isImmersive={isImmersive} />}
              {currentView === 'search' && <SearchScreen />}
              {currentView === 'offers' && <OffersView />}
              {currentView === 'profile' &&
                (pubkey ? (
                  <ProfileScreen pubkey={pubkey} onNavigateToSettings={handleNavigateToSettings} />
                ) : (
                  <div className="profile-guest-placeholder">
                    <p>Sign in to view your profile</p>
                  </div>
                ))}
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
  const [resolvedApiBaseConfig, setResolvedApiBaseConfig] =
    useState<ApiBaseResolution>(apiBaseConfig);
  const [isResolvingLocalApiBase, setIsResolvingLocalApiBase] = useState(() =>
    isLocalApiBase(apiBaseConfig)
  );
  const [localApiCheckFailed, setLocalApiCheckFailed] = useState(false);
  const initialLocalApiConfig = useRef<ApiBaseResolution | null>(
    isLocalApiBase(apiBaseConfig) ? apiBaseConfig : null
  );

  const retryLocalApiHealthCheck = useCallback(() => {
    if (initialLocalApiConfig.current) {
      setResolvedApiBaseConfig(initialLocalApiConfig.current);
      setIsResolvingLocalApiBase(true);
      setLocalApiCheckFailed(false);
    }
  }, []);

  useEffect(() => {
    if (!isResolvingLocalApiBase) {
      return;
    }
    if (!isLocalApiBase(resolvedApiBaseConfig)) {
      setIsResolvingLocalApiBase(false);
      return;
    }
    const controller = new AbortController();
    let isMounted = true;
    const timeout = window.setTimeout(() => controller.abort(), LOCAL_API_TIMEOUT_MS);

    const checkApiHealth = async (url: string): Promise<boolean> => {
      try {
        const response = await fetch(`${url}/api/health`, { signal: controller.signal });
        return response.ok;
      } catch {
        return false;
      }
    };

    const probe = async () => {
      const localApiWorks = await checkApiHealth(resolvedApiBaseConfig.baseUrl);

      if (!localApiWorks && isMounted) {
        const fallbackWorks = await checkApiHealth(FALLBACK_API_BASE.baseUrl);

        if (fallbackWorks) {
          setResolvedApiBaseConfig(FALLBACK_API_BASE);
        } else {
          setLocalApiCheckFailed(true);
          setResolvedApiBaseConfig((current) =>
            isLocalApiBase(current) ? buildApiBaseFallback() : current
          );
        }
      }

      clearTimeout(timeout);
      if (isMounted) {
        setIsResolvingLocalApiBase(false);
      }
    };

    void probe();
    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [resolvedApiBaseConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const apiBase = resolvedApiBaseConfig.baseUrl;
  if (isResolvingLocalApiBase || localApiCheckFailed) {
    return (
      <LoadingFallback
        message={
          localApiCheckFailed
            ? 'API unavailable on localhost:3001 and /api'
            : 'Checking API availability...'
        }
        includeRetry
        onRetry={retryLocalApiHealthCheck}
      />
    );
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
            <AppShell />
          </StatsProvider>
        </RelayProvider>
      </AuthProvider>
    </NostrstackProvider>
  );
}
