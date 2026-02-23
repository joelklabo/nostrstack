import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type IdentityError,
  type IdentityResult,
  type IdentityResolution,
  resolveIdentity,
  type ResolveIdentityOptions
} from '../utils/identity';

export type IdentityResolverState = {
  status: 'idle' | 'validating' | 'resolving' | 'resolved' | 'error';
  result: IdentityResult | null;
  error: IdentityError | null;
};

type UseIdentityResolverOptions = ResolveIdentityOptions & {
  debounceMs?: number;
};

const DEFAULT_STATE: IdentityResolverState = {
  status: 'idle',
  result: null,
  error: null
};

type CachedResolution = {
  result: IdentityResolution;
  expiresAt: number;
};

const IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000;

export function useIdentityResolver(input: string, options: UseIdentityResolverOptions = {}) {
  const { debounceMs = 350, ...resolveOptions } = options;
  const [state, setState] = useState<IdentityResolverState>(DEFAULT_STATE);
  const cacheRef = useRef<Map<string, CachedResolution>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const resolveOptionsRef = useRef(resolveOptions);

  const getResolutionCacheKey = useCallback((value: string): string => {
    return `${value}::${JSON.stringify(resolveOptionsRef.current)}`;
  }, []);

  const getCachedResolution = useCallback(
    (cacheKey: string): IdentityResolution | null => {
      const cached = cacheRef.current.get(cacheKey);
      if (!cached) return null;
      if (cached.expiresAt < Date.now()) {
        cacheRef.current.delete(cacheKey);
        return null;
      }
      return cached.result;
    },
    []
  );

  const setCachedResolution = useCallback((cacheKey: string, result: IdentityResolution) => {
    cacheRef.current.set(cacheKey, { result, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });
  }, []);

  const setStateFromResolution = useCallback((result: IdentityResolution) => {
    if (result.ok) {
      setState({ status: 'resolved', result: result.value, error: null });
    } else {
      setState({ status: 'error', result: null, error: result.error });
    }
  }, []);

  useEffect(() => {
    resolveOptionsRef.current = resolveOptions;
  }, [resolveOptions]);

  const resolveNow = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setState(DEFAULT_STATE);
      return;
    }

    abortRef.current?.abort();
    const cacheKey = getResolutionCacheKey(trimmed);
    const cached = getCachedResolution(cacheKey);
    if (cached) {
      setStateFromResolution(cached);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: 'resolving', error: null }));
    const result = await resolveIdentity(trimmed, {
      ...resolveOptionsRef.current,
      signal: controller.signal
    });
    if (controller.signal.aborted) return;
    setCachedResolution(cacheKey, result);
    setStateFromResolution(result);
  }, [getCachedResolution, getResolutionCacheKey, setCachedResolution, setStateFromResolution]);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setState(DEFAULT_STATE);
      return undefined;
    }

    const cacheKey = getResolutionCacheKey(trimmed);
    const cached = getCachedResolution(cacheKey);
    if (cached) {
      setStateFromResolution(cached);
      return undefined;
    }

    setState((prev) => ({ ...prev, status: 'validating' }));
    const timer = globalThis.setTimeout(() => {
      void resolveNow(trimmed);
    }, debounceMs);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [debounceMs, getCachedResolution, getResolutionCacheKey, input, resolveNow, setStateFromResolution]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    ...state,
    resolveNow
  };
}
