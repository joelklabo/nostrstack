import { useEffect, useRef, useState } from 'react';

type Props = {
  lnbitsUrl?: string;
  adminKey?: string;
  readKey?: string;
  walletId?: string;
  refreshSignal?: number;
  onManualRefresh?: () => void;
  network?: string;
  payerLabel?: string;
};

type WalletInfo = { name?: string; balance?: number; id?: string };

type KeyStatus = { kind: 'admin' | 'read'; status: 'idle' | 'ok' | 'error'; message?: string; url?: string };

export function WalletBalance({ lnbitsUrl, adminKey, readKey, walletId, refreshSignal = 0, onManualRefresh, network = 'regtest', payerLabel = 'lnd-payer (test wallet)' }: Props) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const [lastHeaders, setLastHeaders] = useState<string | null>(null);
  const [lastWalletId, setLastWalletId] = useState<string | null>(() => (typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.walletId') : null));
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([
    { kind: 'admin', status: 'idle' },
    { kind: 'read', status: 'idle' }
  ]);
  const [masked, setMasked] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaceholderKey = (k?: string | null) => !k || k === 'changeme' || k === 'set-me' || k.startsWith('set VITE');
  const canFetch = Boolean(lnbitsUrl && (!isPlaceholderKey(adminKey) || !isPlaceholderKey(readKey)));

  useEffect(() => {
    if (!canFetch) {
      setWallet(null);
      setError('Wallet URL or keys missing.');
      return;
    }
    let cancelled = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      setLastResponse(null);
      setKeyStatuses((prev) => prev.map((k) => ({ ...k, status: 'idle', message: undefined, url: undefined })));
      const base = `${normalizeUrl(lnbitsUrl!).replace(/\/$/, '')}/api/v1/wallet`;

      const attempt = async (key: string, kind: 'admin' | 'read') => {
        const urls = [base, walletId || lastWalletId ? `${base}?usr=${encodeURIComponent(walletId || lastWalletId || '')}` : null].filter(Boolean) as string[];
        for (const url of urls) {
          try {
            setLastRequest(`${kind} → GET ${url}`);
            setLastHeaders('X-Api-Key: <provided>');
            const res = await fetch(url, { headers: { 'X-Api-Key': key, Accept: 'application/json' } });
            const text = await res.text();
            setLastResponse(text.slice(0, 400));
            if (!res.ok) {
              if (res.status === 404 && url === base && urls.length > 1) {
                continue; // fallback to ?usr
              }
              const friendly = res.status === 401 || res.status === 403 ? 'unauthorized (HTTP 401)' : `HTTP ${res.status}`;
              throw new Error(friendly);
            }
            const body = JSON.parse(text);
            setKeyStatuses((prev) => prev.map((k) => (k.kind === kind ? { kind, status: 'ok', url } : k)));
            return body as WalletInfo;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setKeyStatuses((prev) => prev.map((k) => (k.kind === kind ? { kind, status: 'error', message: msg, url: urls.at(-1) } : k)));
          }
        }
        return null;
      };

      try {
        let body: WalletInfo | null = null;
        if (adminKey) body = await attempt(adminKey, 'admin');
        if (!body && readKey) body = await attempt(readKey, 'read');
        if (!body) throw new Error('Wallet not reachable with provided keys.');
        if (cancelled) return;
        setWallet({ name: body.name, balance: body.balance, id: body.id });
        if (body.id && typeof window !== 'undefined') {
          window.localStorage.setItem('nostrstack.lnbits.walletId', body.id);
          setLastWalletId(body.id);
        }
        setUpdatedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unauthorized')) {
          setError('Admin/read key rejected (HTTP 401). Verify you are using the correct wallet keys.');
        } else if (msg.includes('404')) {
          setError('Wallet not found (HTTP 404). Add wallet ID or verify keys/URL.');
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    debounceRef.current = setTimeout(fetchBalance, 120);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canFetch, lnbitsUrl, adminKey, readKey, walletId, lastWalletId, refreshSignal]);

  if (!canFetch) {
    return (
      <div style={card}>
        <strong>Wallet</strong>
        <div style={{ color: '#475569', marginTop: 4 }}>Wallet config missing. Set env vars or paste values above.</div>
        <ul style={{ color: '#475569', marginTop: 4, paddingLeft: '1.1rem' }}>
          <li>Required: <code>VITE_LNBITS_URL</code> and either <code>VITE_LNBITS_ADMIN_KEY</code> or <code>VITE_LNBITS_READ_KEY</code>.</li>
          <li>Optional: <code>VITE_LNBITS_WALLET_ID</code> to prefill the wallet ID field.</li>
          <li>You can also paste keys/URL in the controls above and click “Save & refresh”.</li>
        </ul>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>Wallets</strong>
            <ConnectionPill state={loading ? 'checking' : error ? 'error' : wallet ? 'ok' : 'idle'} />
          </div>
          <span style={{ padding: '0.2rem 0.55rem', borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontWeight: 700, letterSpacing: '0.02em' }}>{(network ?? 'regtest').toUpperCase()}</span>
          <span style={{ fontSize: '0.9rem', color: '#475569' }}>Add funds mines blocks then pays an LNbits invoice so the balance below is real.</span>
        </div>
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

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 10 }}>
        <RoleCard
          title="Receiver"
          accent="#0ea5e9"
          subtitle="LNbits (you)"
          body="Invoices and faucet payments land here. The balance and wallet ID come directly from LNbits over X-Api-Key."
        />
        <RoleCard
          title="Test payer"
          accent="#22c55e"
          subtitle={payerLabel}
          body="Prefunded LND node that pays invoices (including the faucet top-up) so you can bounce sats back and forth."
        />
      </div>
      {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>Error: {error}</div>}
      <div style={{ display: 'grid', gap: 4, fontSize: '0.9rem', color: '#475569', marginBottom: 4 }}>
        {keyStatuses.map((s) => (
          <div key={s.kind} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{s.kind === 'admin' ? 'Admin key' : 'Read key'}</span>
            <StatusPill status={s.status} message={s.message} />
            {s.url && <code style={pillCode}>{s.url}</code>}
          </div>
        ))}
        {lastRequest && <div style={{ color: '#94a3b8' }}>Last request: {lastRequest}</div>}
        {lastHeaders && <div style={{ color: '#94a3b8' }}>Headers: {lastHeaders}</div>}
      </div>
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
              {wallet?.balance != null ? `${wallet.balance} sats` : loading ? <span style={skeleton} /> : '—'}
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
          {masked ? '••••••••' : adminKey || readKey || ''}
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

const pillCode: React.CSSProperties = {
  padding: '0.15rem 0.4rem',
  borderRadius: 8,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  fontSize: '0.8rem'
};

const skeleton: React.CSSProperties = {
  display: 'inline-block',
  width: 80,
  height: 16,
  background: '#e2e8f0',
  borderRadius: 6,
  animation: 'pulse 1.6s ease-in-out infinite'
};

function normalizeUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `http:${url}`;
  if (url.startsWith(':')) return `http://localhost${url}`;
  return `http://${url}`;
}

function RoleCard({ title, subtitle, body, accent }: { title: string; subtitle: string; body: string; accent: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.65rem 0.75rem', background: '#fff', display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, boxShadow: `0 0 0 6px ${accent}1a` }} />
        {title}
      </div>
      <div style={{ color: '#0f172a', fontWeight: 600 }}>{subtitle}</div>
      <div style={{ color: '#475569', fontSize: '0.9rem' }}>{body}</div>
    </div>
  );
}

function StatusPill({ status, message }: { status: KeyStatus['status']; message?: string }) {
  const palette: Record<KeyStatus['status'], { bg: string; fg: string; label: string }> = {
    idle: { bg: '#e2e8f0', fg: '#475569', label: 'idle' },
    ok: { bg: '#ecfdf3', fg: '#166534', label: 'ok' },
    error: { bg: '#fef2f2', fg: '#b91c1c', label: message || 'error' }
  };
  const tone = palette[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.2rem 0.55rem', borderRadius: 999, background: tone.bg, color: tone.fg, border: '1px solid #e2e8f0', fontWeight: 700 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.fg }} />
      {tone.label}
    </span>
  );
}

function ConnectionPill({ state }: { state: 'idle' | 'checking' | 'ok' | 'error' }) {
  const palette: Record<'idle' | 'checking' | 'ok' | 'error', { bg: string; fg: string; label: string }> = {
    idle: { bg: '#e2e8f0', fg: '#475569', label: 'idle' },
    checking: { bg: '#fff7ed', fg: '#c2410c', label: 'checking' },
    ok: { bg: '#ecfdf3', fg: '#166534', label: 'connected' },
    error: { bg: '#fef2f2', fg: '#b91c1c', label: 'error' }
  };
  const tone = palette[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.2rem 0.55rem', borderRadius: 999, background: tone.bg, color: tone.fg, border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.fg }} />
      {tone.label}
    </span>
  );
}
