import { useEffect, useRef, useState } from 'react';

import { Badge } from './ui/Badge';

type Props = {
  lnbitsUrl?: string;
  adminKey?: string;
  readKey?: string;
  walletId?: string;
  apiBase?: string;
  refreshSignal?: number;
  onManualRefresh?: () => void;
  network?: string;
  payerLabel?: string;
};

type WalletInfo = { name?: string; balance?: number; id?: string };

type KeyStatus = { kind: 'admin' | 'read'; status: 'idle' | 'ok' | 'error'; message?: string; url?: string };

export function WalletBalance({ lnbitsUrl, adminKey, readKey, walletId, apiBase, refreshSignal = 0, onManualRefresh, network = 'regtest', payerLabel = 'lnd-payer (test wallet)' }: Props) {
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
    // live wallet stream via /ws/wallet
    if (typeof window === 'undefined') return;
    const origin = (() => {
      try {
        return apiBase ? new URL(apiBase).origin : window.location.origin;
      } catch {
        return window.location.origin;
      }
    })();
    const wsUrl = `${origin.replace(/^http/, 'ws')}/ws/wallet`;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const scheduleReconnect = (delayMs = 500) => {
      if (cancelled) return;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, delayMs);
    };

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect(1000);
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string; balance?: number; id?: string; name?: string; time?: number };
          if (msg.type === 'wallet') {
            setWallet({ name: msg.name, balance: msg.balance, id: msg.id });
            setUpdatedAt(msg.time ? msg.time * 1000 : Date.now());
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        scheduleReconnect(500);
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (!ws) return;
      // Avoid React/StrictMode warnings from closing a CONNECTING socket.
      if (ws.readyState === WebSocket.CONNECTING) {
        const pending = ws;
        pending.onopen = () => pending.close();
        pending.onerror = null;
        pending.onclose = null;
        return;
      }
      ws.close();
    };
  }, [apiBase]);

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
      const target = `${(apiBase || '/api').replace(/\/$/, '')}/wallet/info`;

      const attempt = async (key: string, kind: 'admin' | 'read') => {
        const payload = {
          baseUrl: lnbitsUrl,
          apiKey: key,
          walletId: walletId || lastWalletId || undefined
        };
        try {
          setLastRequest(`${kind} → POST ${target}`);
          setLastHeaders('Content-Type: application/json');
          const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          setLastResponse(text.slice(0, 400));
          if (!res.ok) {
            const friendly = res.status === 401 || res.status === 403 ? 'unauthorized (HTTP 401)' : `HTTP ${res.status}`;
            throw new Error(friendly);
          }
          const body = JSON.parse(text);
          if (!body?.wallet) throw new Error('missing wallet in response');
          setKeyStatuses((prev) => prev.map((k) => (k.kind === kind ? { kind, status: 'ok', url: target } : k)));
          return body.wallet as WalletInfo;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setKeyStatuses((prev) => prev.map((k) => (k.kind === kind ? { kind, status: 'error', message: msg, url: target } : k)));
          return null;
        }
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
  }, [canFetch, lnbitsUrl, adminKey, readKey, walletId, lastWalletId, refreshSignal, apiBase]);

  if (!canFetch) {
    return (
      <div style={card}>
        <strong>Wallet</strong>
        <div style={{ color: 'var(--nostrstack-color-text-muted)', marginTop: 4 }}>
          Wallet config missing. Set env vars or paste values above.
        </div>
        <ul style={{ color: 'var(--nostrstack-color-text-muted)', marginTop: 4, paddingLeft: '1.1rem' }}>
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
          <Badge tone="accent">{(network ?? 'regtest').toUpperCase()}</Badge>
          <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
            Add funds mines blocks then pays an LNbits invoice so the balance below is real.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setUpdatedAt(Date.now());
            onManualRefresh?.();
          }}
          className="nostrstack-btn nostrstack-btn--sm"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 10 }}>
        <RoleCard
          title="Receiver"
          tone="info"
          subtitle="LNbits (you)"
          body="Invoices and faucet payments land here. The balance and wallet ID come directly from LNbits over X-Api-Key."
        />
        <RoleCard
          title="Test payer"
          tone="success"
          subtitle={payerLabel}
          body="Prefunded LND node that pays invoices (including the faucet top-up) so you can bounce sats back and forth."
        />
      </div>
      {error && (
        <div style={{ color: 'var(--nostrstack-color-danger)', fontSize: '0.9rem' }}>Error: {error}</div>
      )}
      <div style={{ display: 'grid', gap: 4, fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)', marginBottom: 4 }}>
        {keyStatuses.map((s) => (
          <div key={s.kind} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{s.kind === 'admin' ? 'Admin key' : 'Read key'}</span>
            <StatusPill status={s.status} message={s.message} />
            {s.url && <code style={pillCode}>{s.url}</code>}
          </div>
        ))}
        {lastRequest && <div style={{ color: 'var(--nostrstack-color-text-subtle)' }}>Last request: {lastRequest}</div>}
        {lastHeaders && <div style={{ color: 'var(--nostrstack-color-text-subtle)' }}>Headers: {lastHeaders}</div>}
      </div>
      {lastResponse && (
        <details open style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-muted)' }}>
          <summary>Last response</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{lastResponse}</pre>
        </details>
      )}
      {!error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--nostrstack-color-text)' }}>
              {wallet?.balance != null ? `${wallet.balance} sats` : loading ? <span style={skeleton} /> : '—'}
            </span>
            {wallet?.name && <span style={{ color: 'var(--nostrstack-color-text-muted)' }}>{wallet.name}</span>}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : '—'}
          </div>
          {wallet?.id && (
            <div style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-subtle)', wordBreak: 'break-all' }}>
              Wallet ID: {wallet.id}
            </div>
          )}
          {lastWalletId && !wallet?.id && (
            <div style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-subtle)' }}>
              Last known wallet ID: {lastWalletId}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <code style={{ padding: '0.25rem 0.45rem', borderRadius: 'var(--nostrstack-radius-sm)', background: 'var(--nostrstack-color-surface-strong)', border: '1px solid var(--nostrstack-color-border)', color: 'var(--nostrstack-color-text)' }}>{normalizeUrl(lnbitsUrl || '')}</code>
        <code style={{ padding: '0.25rem 0.45rem', borderRadius: 'var(--nostrstack-radius-sm)', background: 'var(--nostrstack-color-surface-strong)', border: '1px solid var(--nostrstack-color-border)', color: 'var(--nostrstack-color-text)' }}>
          {masked ? '••••••••' : adminKey || readKey || ''}
        </code>
        <button type="button" onClick={() => setMasked((v) => !v)} className="nostrstack-btn nostrstack-btn--sm">
          {masked ? 'Show key' : 'Hide key'}
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid var(--nostrstack-color-border)',
  borderRadius: 'var(--nostrstack-radius-lg)',
  padding: '0.75rem 0.85rem',
  background: 'var(--nostrstack-color-surface-subtle)'
};

const pillCode: React.CSSProperties = {
  padding: '0.15rem 0.4rem',
  borderRadius: 'var(--nostrstack-radius-sm)',
  background: 'var(--nostrstack-color-surface-strong)',
  border: '1px solid var(--nostrstack-color-border)',
  color: 'var(--nostrstack-color-text)',
  fontSize: '0.8rem'
};

const skeleton: React.CSSProperties = {
  display: 'inline-block',
  width: 80,
  height: 16,
  background: 'var(--nostrstack-color-surface-strong)',
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

function RoleCard({ title, subtitle, body, tone }: { title: string; subtitle: string; body: string; tone: 'info' | 'success' }) {
  const accent = tone === 'success' ? 'var(--nostrstack-color-success)' : 'var(--nostrstack-color-info)';
  return (
    <div className="nostrstack-card" style={{ padding: '0.65rem 0.75rem', background: 'var(--nostrstack-color-surface)', display: 'grid', gap: 4, boxShadow: 'var(--nostrstack-shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--nostrstack-color-text)' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 'var(--nostrstack-radius-pill)',
            background: accent,
            boxShadow: `0 0 0 6px color-mix(in oklab, ${accent} 22%, transparent)`
          }}
        />
        {title}
      </div>
      <div style={{ color: 'var(--nostrstack-color-text)', fontWeight: 600 }}>{subtitle}</div>
      <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>{body}</div>
    </div>
  );
}

function StatusPill({ status, message }: { status: KeyStatus['status']; message?: string }) {
  const palette: Record<KeyStatus['status'], { bg: string; fg: string; dot: string; border: string; label: string }> = {
    idle: {
      bg: 'var(--nostrstack-color-surface-strong)',
      fg: 'var(--nostrstack-color-text-muted)',
      dot: 'var(--nostrstack-color-text-subtle)',
      border: 'var(--nostrstack-color-border)',
      label: 'idle'
    },
    ok: {
      bg: 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))',
      fg: 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))',
      dot: 'var(--nostrstack-color-success)',
      border: 'color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border))',
      label: 'ok'
    },
    error: {
      bg: 'color-mix(in oklab, var(--nostrstack-color-danger) 14%, var(--nostrstack-color-surface))',
      fg: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
      dot: 'var(--nostrstack-color-danger)',
      border: 'color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
      label: message || 'error'
    }
  };
  const tone = palette[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.2rem 0.55rem', borderRadius: 'var(--nostrstack-radius-pill)', background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, fontWeight: 700 }}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--nostrstack-radius-pill)', background: tone.dot }} />
      {tone.label}
    </span>
  );
}

function ConnectionPill({ state }: { state: 'idle' | 'checking' | 'ok' | 'error' }) {
  const palette: Record<'idle' | 'checking' | 'ok' | 'error', { bg: string; fg: string; dot: string; border: string; label: string }> = {
    idle: {
      bg: 'var(--nostrstack-color-surface-strong)',
      fg: 'var(--nostrstack-color-text-muted)',
      dot: 'var(--nostrstack-color-text-subtle)',
      border: 'var(--nostrstack-color-border)',
      label: 'idle'
    },
    checking: {
      bg: 'color-mix(in oklab, var(--nostrstack-color-warning) 14%, var(--nostrstack-color-surface))',
      fg: 'color-mix(in oklab, var(--nostrstack-color-warning) 70%, var(--nostrstack-color-text))',
      dot: 'var(--nostrstack-color-warning)',
      border: 'color-mix(in oklab, var(--nostrstack-color-warning) 35%, var(--nostrstack-color-border))',
      label: 'checking'
    },
    ok: {
      bg: 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))',
      fg: 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))',
      dot: 'var(--nostrstack-color-success)',
      border: 'color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border))',
      label: 'connected'
    },
    error: {
      bg: 'color-mix(in oklab, var(--nostrstack-color-danger) 14%, var(--nostrstack-color-surface))',
      fg: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
      dot: 'var(--nostrstack-color-danger)',
      border: 'color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
      label: 'error'
    }
  };
  const tone = palette[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.2rem 0.55rem', borderRadius: 'var(--nostrstack-radius-pill)', background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, fontWeight: 700, fontSize: '0.85rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--nostrstack-radius-pill)', background: tone.dot }} />
      {tone.label}
    </span>
  );
}
