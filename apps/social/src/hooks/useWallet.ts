import { useNostrstackConfig } from '@nostrstack/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  resolveGalleryApiBase,
  resolveRuntimeApiBase,
  resolveRuntimeWsUrl
} from '../utils/api-base';

const WALLET_WS_MAX_ATTEMPTS = 5;
const WALLET_WS_BASE_DELAY_MS = 1000;
const WALLET_WS_MAX_DELAY_MS = 30000;
const WALLET_WS_JITTER = 0.3;
const WS_ERROR_SUPPRESSION_MS = 10_000;

function suppressExpectedWsErrors<T>(fn: () => T): T {
  const originalError = console.error;
  const originalWarn = console.warn;
  const startTime = Date.now();
  const filter = (args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('WebSocket connection to') ||
        message.includes('net::ERR_CONNECTION_REFUSED') ||
        message.includes('net::ERR_CONNECTION_RESET') ||
        message.includes('net::ERR_NAME_NOT_RESOLVED') ||
        message.includes('net::ERR_INTERNET_DISCONNECTED'))
    ) {
      if (Date.now() - startTime < WS_ERROR_SUPPRESSION_MS) {
        return true;
      }
    }
    return false;
  };
  console.error = (...args: unknown[]) => {
    if (!filter(args)) originalError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    if (!filter(args)) originalWarn.apply(console, args);
  };
  try {
    return fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function applyJitter(baseMs: number, jitter: number) {
  const spread = baseMs * jitter;
  const offset = (Math.random() * 2 - 1) * spread;
  return Math.max(0, Math.round(baseMs + offset));
}

function computeBackoffMs(attempt: number) {
  const base = WALLET_WS_BASE_DELAY_MS * Math.pow(2, attempt);
  const capped = Math.min(WALLET_WS_MAX_DELAY_MS, base);
  return applyJitter(capped, WALLET_WS_JITTER);
}

async function checkWalletEnabled(runtimeApiBase: string): Promise<boolean> {
  const apiBase = runtimeApiBase;
  if (!apiBase) return false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = globalThis.setTimeout(() => resolve(null), 3000);
  });
  try {
    const url = `${apiBase}/debug/ws-wallet`;
    const res = await Promise.race([fetch(url), timeoutPromise]);
    if (!res) return false;
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled ?? false;
  } catch {
    return false;
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
}

function safeClose(socket: WebSocket | null) {
  if (!socket) return;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try {
      socket.close();
    } catch {
      // Ignore close errors from already-closed sockets.
    }
  }
}

export type WalletData = {
  id?: string;
  name?: string;
  balance?: number;
};

export type WalletState = {
  wallet: WalletData | null;
  isConnecting: boolean;
  isOffline: boolean;
  error: string | null;
  retry: () => void;
};

export function useWallet(enabled: boolean = true): WalletState {
  const cfg = useNostrstackConfig();
  const apiBaseConfig = useMemo(
    () =>
      resolveGalleryApiBase({
        apiBase: cfg.apiBase,
        baseUrl: cfg.baseUrl,
        apiBaseConfig: cfg.apiBaseConfig
      }),
    [cfg.apiBase, cfg.apiBaseConfig, cfg.baseUrl]
  );
  const apiBase = useMemo(
    () => resolveRuntimeApiBase(apiBaseConfig.baseUrl),
    [apiBaseConfig.baseUrl]
  );
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasWalletSnapshot = useRef(false);
  const walletEnabledChecked = useRef(false);
  const walletEnabledRef = useRef(false);

  useEffect(() => {
    hasWalletSnapshot.current = !!wallet;
  }, [wallet]);

  const retry = useCallback(() => {
    setIsConnecting(!hasWalletSnapshot.current);
    setIsOffline(false);
    if (!hasWalletSnapshot.current) {
      setWallet(null);
    }
    setError(null);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsConnecting(false);
      setWallet(null);
      setError(null);
      setIsOffline(false);
      hasWalletSnapshot.current = false;
      walletEnabledChecked.current = false;
      return;
    }

    let cancelled = false;

    async function initWallet() {
      const wsUrl = resolveRuntimeWsUrl(apiBaseConfig.baseUrl, '/ws/wallet');
      if (!wsUrl) {
        setIsConnecting(false);
        setError('No wallet URL configured');
        hasWalletSnapshot.current = false;
        setWallet(null);
        return;
      }

      if (!walletEnabledChecked.current) {
        walletEnabledChecked.current = true;
        const isEnabled = await checkWalletEnabled(apiBase);
        walletEnabledRef.current = isEnabled;
        if (!isEnabled || cancelled) {
          setIsConnecting(false);
          hasWalletSnapshot.current = false;
          setWallet(null);
          return;
        }
      } else if (!walletEnabledRef.current) {
        setIsConnecting(false);
        hasWalletSnapshot.current = false;
        setWallet(null);
        return;
      }

      const hadSnapshot = hasWalletSnapshot.current;
      if (!hadSnapshot) {
        hasWalletSnapshot.current = false;
        setWallet(null);
      }
      setIsConnecting(!hadSnapshot);
      setError(null);

      let ws: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let reconnectScheduled = false;
      let attempt = retryCount;
      let offlineLogged = false;

      const markOffline = (reason: string) => {
        if (cancelled || reconnectScheduled) return;
        reconnectScheduled = true;
        setIsOffline(true);
        setIsConnecting(false);
        if (!hasWalletSnapshot.current) {
          setError(reason);
          setWallet(null);
        }
        if (!offlineLogged) {
          console.warn(`Wallet offline: ${reason}`);
          offlineLogged = true;
        }
      };

      const scheduleReconnect = (message: string) => {
        if (cancelled || reconnectScheduled) return;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          markOffline('Browser offline');
          return;
        }

        if (attempt >= WALLET_WS_MAX_ATTEMPTS) {
          markOffline('Max retries reached');
          return;
        }

        reconnectScheduled = true;
        if (!hasWalletSnapshot.current) {
          setError(`${message} Retrying...`);
          setWallet(null);
        }
        setIsConnecting(false);

        const delay = computeBackoffMs(attempt);
        const nextAttempt = attempt + 1;
        attempt = nextAttempt;

        reconnectTimer = globalThis.setTimeout(() => {
          if (cancelled) return;
          setRetryCount((count) => count + 1);
        }, delay);
      };

      const timer = globalThis.setTimeout(() => {
        if (cancelled) return;
        ws = suppressExpectedWsErrors(() => new WebSocket(wsUrl));

        ws.onopen = () => {
          if (cancelled) return;
          reconnectScheduled = false;
          attempt = 0;
          offlineLogged = false;
          setIsOffline(false);
          setIsConnecting(false);
          setError(null);
        };

        ws.onerror = () => {
          if (cancelled) return;
          scheduleReconnect('Failed to connect to wallet');
        };

        ws.onclose = () => {
          if (cancelled) return;
          scheduleReconnect('Wallet connection closed');
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'wallet') {
              hasWalletSnapshot.current = true;
              setWallet({
                id: data.id,
                name: data.name,
                balance: data.balance
              });
            }
          } catch (err) {
            console.error('Wallet WS error', err);
          }
        };
      }, 0);

      const handleOnline = () => {
        if (cancelled) return;
        offlineLogged = false;
        reconnectScheduled = false;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        attempt = 0;
        setIsOffline(false);
        setRetryCount((count) => count + 1);
      };

      const handleOffline = () => {
        if (cancelled) return;
        safeClose(ws);
        markOffline('Browser offline');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        globalThis.clearTimeout(timer);
        if (reconnectTimer) {
          globalThis.clearTimeout(reconnectTimer);
        }
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        safeClose(ws);
      };
    }

    const cleanup = initWallet();

    return () => {
      cancelled = true;
      cleanup?.then((innerCleanup) => innerCleanup?.());
    };
  }, [apiBase, apiBaseConfig.baseUrl, enabled, retryCount]);

  return { wallet, isConnecting, isOffline, error, retry };
}
