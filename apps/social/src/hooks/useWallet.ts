import { useNostrstackConfig } from '@nostrstack/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  resolveGalleryApiBase,
  resolveRuntimeApiBase,
  resolveRuntimeWsUrl
} from '../utils/api-base';

async function checkWalletEnabled(runtimeApiBase: string): Promise<boolean> {
  const apiBase = runtimeApiBase;
  if (!apiBase) return false;
  try {
    const url = `${apiBase}/debug/ws-wallet`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled ?? false;
  } catch {
    return false;
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasWalletSnapshot = useRef(false);

  useEffect(() => {
    hasWalletSnapshot.current = !!wallet;
  }, [wallet]);

  const retry = () => {
    setIsConnecting(!hasWalletSnapshot.current);
    if (!hasWalletSnapshot.current) {
      setWallet(null);
    }
    setError(null);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    if (!enabled) {
      setIsConnecting(false);
      setWallet(null);
      setError(null);
      hasWalletSnapshot.current = false;
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

      const isEnabled = await checkWalletEnabled(apiBase);
      if (!isEnabled || cancelled) {
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
      const retryDelayMs = Math.min(500 * 2 ** Math.min(retryCount, 4), 15000);

      const scheduleReconnect = (message: string) => {
        if (cancelled || reconnectScheduled) return;
        reconnectScheduled = true;
        if (!hasWalletSnapshot.current) {
          setError(`${message} Retrying...`);
          setWallet(null);
        }
        setIsConnecting(false);

        reconnectTimer = globalThis.setTimeout(() => {
          if (cancelled) return;
          setRetryCount((count) => count + 1);
        }, retryDelayMs);
      };

      const timer = globalThis.setTimeout(() => {
        if (cancelled) return;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (cancelled) return;
          reconnectScheduled = false;
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

      return () => {
        globalThis.clearTimeout(timer);
        if (reconnectTimer) {
          globalThis.clearTimeout(reconnectTimer);
        }
        safeClose(ws);
      };
    }

    const cleanup = initWallet();

    return () => {
      cancelled = true;
      cleanup?.then((innerCleanup) => innerCleanup?.());
    };
  }, [apiBase, apiBaseConfig.baseUrl, enabled, retryCount]);

  return { wallet, isConnecting, error, retry };
}
