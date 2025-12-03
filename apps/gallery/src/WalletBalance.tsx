import { useEffect, useState } from 'react';

type Props = {
  lnbitsUrl?: string;
  adminKey?: string;
  refreshSignal?: number;
  onManualRefresh?: () => void;
};

type WalletInfo = { name?: string; balance?: number; id?: string };

export function WalletBalance({ lnbitsUrl, adminKey, refreshSignal = 0, onManualRefresh }: Props) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastWalletId, setLastWalletId] = useState<string | null>(() => (typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.walletId') : null));
  const [masked, setMasked] = useState(true);

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
      setLastResponse(null);
      try {
        const target = `${normalizeUrl(lnbitsUrl!).replace(/\/$/, '')}/api/v1/wallet`;
        const res = await fetch(target, { headers: { 'X-Api-Key': adminKey!, Accept: 'application/json' } });
        const text = await res.text();
        setLastResponse(text.slice(0, 400));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = JSON.parse(text);
        setWallet({ name: body.name, balance: body.balance, id: body.id });
        if (body.id && typeof window !== 'undefined') {
          window.localStorage.setItem('nostrstack.lnbits.walletId', body.id);
          setLastWalletId(body.id);
        }
        setUpdatedAt(Date.now());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404')) {
            setError('Wallet not found (HTTP 404). Is the LNbits URL/admin key correct?');
        } else {
          setError(msg);
        }
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
        <button
          type="button"
          onClick={() => {
            setUpdatedAt(Date.now());
            onManualRefresh?.();
          }}
          style={btn}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>Error: {error}</div>}
      {lastResponse && (
        <details style={{ fontSize: '0.85rem', color: '#475569' }}>
          <summary>Last response</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{lastResponse}</pre>
        </details>
      )}
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
          {lastWalletId && !wallet?.id && (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Last known wallet ID: {lastWalletId}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <code style={{ padding: '0.25rem 0.45rem', borderRadius: 8, background: '#e2e8f0', color: '#0f172a' }}>{normalizeUrl(lnbitsUrl || '')}</code>
        <code style={{ padding: '0.25rem 0.45rem', borderRadius: 8, background: '#e2e8f0', color: '#0f172a' }}>
          {masked ? '••••••••' : adminKey || ''}
        </code>
        <button type="button" onClick={() => setMasked((v) => !v)} style={btn}>
          {masked ? 'Show key' : 'Hide key'}
        </button>
      </div>
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

function normalizeUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `http:${url}`;
  if (url.startsWith(':')) return `http://localhost${url}`;
  return `http://${url}`;
}
