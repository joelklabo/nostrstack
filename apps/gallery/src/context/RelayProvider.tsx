import { parseRelays, useAuth } from '@nostrstack/blog-kit';
import { type Filter, SimplePool } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { relayMonitor } from '../nostr/relayHealth';

// Reusing default relays from API module logic
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

export type RelayMode = 'read' | 'write' | 'both';

export type RelayConfig = {
  url: string;
  mode: RelayMode;
};

type RelayContextValue = {
  relays: string[]; // Merged list of URLs for active use
  userRelays: RelayConfig[]; // Raw list from Kind 10002
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  saveRelays: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export const RelayContext = createContext<RelayContextValue | null>(null);

export function RelayProvider({ children }: { children: ReactNode }) {
  const { pubkey, signEvent } = useAuth();
  const [userRelays, setUserRelays] = useState<RelayConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_monitorVersion, setMonitorVersion] = useState(0);

  // Parse environment default relays once
  const bootstrapRelays = useMemo(() => {
    const envRelays = parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
    return envRelays.length ? envRelays : DEFAULT_RELAYS;
  }, []); // Empty deps - only parse once on mount

  // Listen for relay health changes (debounced to prevent render storms)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMonitorVersion((v) => v + 1);
      }, 500);
    };
    const unsubscribe = relayMonitor.subscribe(debouncedUpdate);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  // Fetch Kind 10002 on mount or auth change
  useEffect(() => {
    if (!pubkey) {
      setIsLoading(false);
      setUserRelays([]);
      return;
    }

    setIsLoading(true);
    const pool = new SimplePool();
    const filter: Filter = { kinds: [10002], authors: [pubkey] };

    // Use bootstrap relays to find the user's relay list
    pool.get(bootstrapRelays, filter)
      .then((event) => {
        if (event) {
          const parsed = event.tags
            .filter((t) => t[0] === 'r')
            .map((t) => {
              const url = normalizeURL(t[1]);
              const marker = t[2];
              let mode: RelayMode = 'both';
              if (marker === 'read') mode = 'read';
              if (marker === 'write') mode = 'write';
              return { url, mode };
            });
          setUserRelays(parsed);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch Kind 10002:', err);
        // Silent fail, fall back to defaults
      })
      .finally(() => {
        setIsLoading(false);
        try { pool.close(bootstrapRelays); } catch { /* ignore */ }
      });

    return () => {
      // Cleanup pool if needed, though get() is one-off
    };
  }, [pubkey, bootstrapRelays]);

  const addRelay = useCallback((url: string) => {
    try {
      const normalized = normalizeURL(url);
      setUserRelays((prev) => {
        if (prev.some((r) => r.url === normalized)) return prev;
        return [...prev, { url: normalized, mode: 'both' }];
      });
    } catch {
      setError(`Invalid relay URL: ${url}`);
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  const removeRelay = useCallback((url: string) => {
    setUserRelays((prev) => prev.filter((r) => r.url !== url));
  }, []);

  const saveRelays = useCallback(async () => {
    if (!pubkey || !signEvent) return;
    setError(null);

    const tags = userRelays.map((r) => {
      if (r.mode === 'both') return ['r', r.url];
      return ['r', r.url, r.mode];
    });

    const template = {
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
      pubkey
    };

    try {
      const event = await signEvent(template);
      const pool = new SimplePool();
      // Publish to both the new list and the bootstrap list to ensure propagation
      const publishRelays = [...new Set([...bootstrapRelays, ...userRelays.map(r => r.url)])];
      
      await Promise.allSettled(pool.publish(publishRelays, event));
      try { pool.close(publishRelays); } catch { /* ignore */ }
    } catch (e) {
      console.error('Failed to save relays:', e);
      setError('Failed to publish relay list.');
    }
  }, [pubkey, signEvent, userRelays, bootstrapRelays]);

  // Merge user relays with bootstrap/defaults for the active list
  // Include _monitorVersion to re-filter when health changes (debounced)
  const activeRelays = useMemo(() => {
    const merged = [...new Set([
      ...bootstrapRelays,
      ...userRelays.map((r) => r.url)
    ])];
    return merged.filter(url => relayMonitor.isHealthy(url));
  }, [bootstrapRelays, userRelays, _monitorVersion]);

  const value: RelayContextValue = {
    relays: activeRelays,
    userRelays,
    addRelay,
    removeRelay,
    saveRelays,
    isLoading,
    error
  };

  return (
    <RelayContext.Provider value={value}>
      {children}
    </RelayContext.Provider>
  );
}
