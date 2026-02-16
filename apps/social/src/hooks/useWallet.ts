import { useEffect, useRef, useState } from 'react';

import { resolveRuntimeWsUrl } from '../utils/api-base';

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

export function useWallet(): WalletState {
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
    const wsUrl = resolveRuntimeWsUrl(import.meta.env.VITE_API_BASE_URL, '/ws/wallet');
    if (!wsUrl) {
      setIsConnecting(false);
      setError('No wallet URL configured');
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
    let cancelled = false;
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
      cancelled = true;
      globalThis.clearTimeout(timer);
      if (reconnectTimer) {
        globalThis.clearTimeout(reconnectTimer);
      }
      safeClose(ws);
    };
  }, [retryCount]);

  return { wallet, isConnecting, error, retry };
}
