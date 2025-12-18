import { useEffect, useState } from 'react';

function resolveWalletWs(baseURL?: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = raw.replace(/\/$/, '');
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

export type WalletData = {
  id?: string;
  name?: string;
  balance?: number;
};

export function useWallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  
  useEffect(() => {
    const wsUrl = resolveWalletWs(import.meta.env.VITE_API_BASE_URL);
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    
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

    return () => {
      ws.close();
    };
  }, []);
  
  return wallet;
}
