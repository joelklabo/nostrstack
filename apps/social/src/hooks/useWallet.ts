import { useEffect, useState } from 'react';

function resolveWalletWs(baseURL?: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = preferSecureBase(raw.replace(/\/$/, ''));
  if (base === '/api') {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/wallet`;
  }
  if (!base) {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/wallet`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/wallet`;
  }
  return `${window.location.origin.replace(/^http/i, 'ws')}${base}/ws/wallet`;
}

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
  return base.replace(/^http:/i, 'https:');
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

export function useWallet(): WalletState {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = () => {
    setError(null);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    const wsUrl = resolveWalletWs(import.meta.env.VITE_API_BASE_URL);
    if (!wsUrl) {
      setIsConnecting(false);
      setError('No wallet URL configured');
      return;
    }

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
        setIsConnecting(false);
      };

      ws.onclose = () => {
        if (cancelled) return;
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
