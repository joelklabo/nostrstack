import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type AppRoute,
  normalizeLocation,
  normalizePath,
  parseAppRoute,
  type RouteLocation
} from '../../utils/navigation';

type NavigateOptions = {
  replace?: boolean;
  state?: Record<string, unknown>;
};

function getCurrentLocation(): RouteLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hash: '', fullPath: '/' };
  }

  return normalizeLocation(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function useRouteState() {
  const [location, setLocation] = useState<RouteLocation>(() => getCurrentLocation());
  const [isNavigating, setIsNavigating] = useState(false);

  const syncFromWindow = useCallback(() => {
    const next = getCurrentLocation();
    setLocation((current) => {
      if (
        current.pathname === next.pathname &&
        current.search === next.search &&
        current.hash === next.hash &&
        current.fullPath === next.fullPath
      ) {
        return current;
      }
      return next;
    });
    setIsNavigating(false);
  }, []);

  useEffect(() => {
    syncFromWindow();

    const handlePopState = () => {
      syncFromWindow();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', syncFromWindow);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', syncFromWindow);
    };
  }, [syncFromWindow]);

  const route = useMemo<AppRoute>(() => parseAppRoute(location.pathname), [location.pathname]);

  const navigate = useCallback(
    (path: string, options: NavigateOptions = {}) => {
      if (typeof window === 'undefined') return;

      const normalized = normalizePath(path);
      if (normalized === location.fullPath) {
        setIsNavigating(false);
        return;
      }

      const navigationState = options.state ?? {};
      if (options.replace) {
        window.history.replaceState(navigationState, '', normalized);
      } else {
        window.history.pushState(navigationState, '', normalized);
      }
      setLocation(normalizeLocation(normalized));
      setIsNavigating(true);
      window.dispatchEvent(new PopStateEvent('popstate', { state: navigationState }));
    },
    [location.fullPath]
  );

  return {
    route,
    location,
    isNavigating,
    navigate
  };
}

