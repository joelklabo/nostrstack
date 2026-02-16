import { useEffect, useState } from 'react';

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

  const retry = () => {
    setIsConnecting(true);
    setError(null);
    setWallet(null);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    const wsUrl = resolveRuntimeWsUrl(import.meta.env.VITE_API_BASE_URL, '/ws/wallet');
    if (!wsUrl) {
      setIsConnecting(false);
      setError('No wallet URL configured');
      setWallet(null);
      return;
    }

    setIsConnecting(true);
    setError(null);
    setWallet(null);

    let ws: WebSocket | null = null;
    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (cancelled) return;
        setIsConnecting(false);
        setError(null);
      };

      ws.onerror = () => {
        if (cancelled) return;
        setError('Failed to connect to wallet');
        setWallet(null);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWallet(null);
        setIsConnecting(false);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'wallet') {
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
      safeClose(ws);
    };
  }, [retryCount]);

  return { wallet, isConnecting, error, retry };
}
