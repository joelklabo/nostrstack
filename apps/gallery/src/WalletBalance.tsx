import { useEffect, useState } from 'react';

type Props = {
  lnbitsUrl?: string;
  adminKey?: string;
  refreshSignal?: number;
};

type WalletInfo = { name?: string; balance?: number; id?: string };

export function WalletBalance({ lnbitsUrl, adminKey, refreshSignal = 0 }: Props) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const canFetch = Boolean(lnbitsUrl && adminKey && adminKey !== 'set VITE_LNBITS_ADMIN_KEY');

  useEffect(() => {
    if (!canFetch) {
      setWallet(null);
      setError('Wallet URL or admin key missing.');
      return;
    }
    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      try {
        const target = `${lnbitsUrl!.replace(/\/$/, '')}/api/v1/wallet`;
        const res = await fetch(target, { headers: { 'X-Api-Key': adminKey!, Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        setWallet({ name: body.name, balance: body.balance, id: body.id });
        setUpdatedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [canFetch, lnbitsUrl, adminKey, refreshSignal]);

  if (!canFetch) {
    return (
      <div style={card}>
        <strong>Wallet</strong>
        <div style={{ color: '#475569', marginTop: 4 }}>Set VITE_LNBITS_URL and VITE_LNBITS_ADMIN_KEY to show balance.</div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <strong>Wallet</strong>
        <button type="button" onClick={() => setUpdatedAt(Date.now())} style={btn} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>Error: {error}</div>}
      {!error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              {wallet?.balance != null ? `${wallet.balance} sats` : loading ? 'Loading…' : '—'}
            </span>
            {wallet?.name && <span style={{ color: '#475569' }}>{wallet.name}</span>}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : '—'}
          </div>
          {wallet?.id && (
            <div style={{ fontSize: '0.85rem', color: '#64748b', wordBreak: 'break-all' }}>
              Wallet ID: {wallet.id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '0.75rem 0.85rem',
  background: '#f8fafc'
};

const btn: React.CSSProperties = {
  padding: '0.35rem 0.65rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer'
};
