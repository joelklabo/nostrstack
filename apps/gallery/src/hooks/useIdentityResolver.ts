import { useCallback, useEffect, useRef, useState } from 'react';

import { type IdentityError, type IdentityResult, resolveIdentity, type ResolveIdentityOptions } from '../utils/identity';

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

export function useIdentityResolver(input: string, options: UseIdentityResolverOptions = {}) {
  const { debounceMs = 350, ...resolveOptions } = options;
  const [state, setState] = useState<IdentityResolverState>(DEFAULT_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const resolveOptionsRef = useRef(resolveOptions);

  useEffect(() => {
    resolveOptionsRef.current = resolveOptions;
  }, [resolveOptions]);

  const resolveNow = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setState(DEFAULT_STATE);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: 'resolving', error: null }));
    const result = await resolveIdentity(trimmed, { ...resolveOptionsRef.current, signal: controller.signal });
    if (controller.signal.aborted) return;

    if (result.ok) {
      setState({ status: 'resolved', result: result.value, error: null });
    } else {
      setState({ status: 'error', result: null, error: result.error });
    }
  }, []);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setState(DEFAULT_STATE);
      return undefined;
    }

    setState((prev) => ({ ...prev, status: 'validating' }));
    const timer = globalThis.setTimeout(() => {
      void resolveNow(trimmed);
    }, debounceMs);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [input, debounceMs, resolveNow]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    ...state,
    resolveNow
  };
}
