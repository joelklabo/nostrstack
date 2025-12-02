import { autoMount, mountCommentWidget, mountPayToAction, mountTipButton } from '@nostrstack/embed';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { WalletPanel } from './WalletPanel';

type RelayInfo = { relays: string[]; mode: 'mock' | 'real' };
type Health = { label: string; status: 'ok' | 'fail' | 'error' | 'skipped' | 'mock' | 'unknown'; detail?: string };

const demoHost = import.meta.env.VITE_NOSTRSTACK_HOST ?? 'mock';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'mock';
const enableReal = import.meta.env.VITE_ENABLE_REAL_PAYMENTS === 'true';
const relaysEnvRaw = import.meta.env.VITE_NOSTRSTACK_RELAYS;
const relaysEnvDefault = relaysEnvRaw
  ? relaysEnvRaw.split(',').map((r: string) => r.trim()).filter(Boolean)
  : ['wss://relay.damus.io'];
const isMock = demoHost === 'mock' || apiBase === 'mock';
const lnbitsUrl = import.meta.env.VITE_LNBITS_URL ?? 'http://localhost:15001';
const lnbitsAdminKey = import.meta.env.VITE_LNBITS_ADMIN_KEY ?? 'set-me';
const RELAY_STORAGE_KEY = 'nostrstack.relays';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e3e3e3', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}

function parseRelays(input: string): string[] {
  return input
    .split(',')
    .map((r: string) => r.trim())
    .filter(Boolean);
}

function useMountWidgets(username: string, amount: number, relaysCsv: string, onUnlock?: () => void) {
  useEffect(() => {
    const tipHost = document.getElementById('tip-container');
    const payHost = document.getElementById('pay-container');
    const unlockHost = document.getElementById('unlock-status');
    const commentsHost = document.getElementById('comments-container');
    const relayStatus = document.getElementById('relay-status');
    if (!tipHost || !payHost || !commentsHost) return;

    tipHost.innerHTML = '';
    payHost.innerHTML = '';
    commentsHost.innerHTML = '';
    if (unlockHost) {
      unlockHost.textContent = 'Locked';
    }

    mountTipButton(tipHost, { username, amountSats: amount, host: demoHost, baseURL: apiBase });
    mountPayToAction(payHost, {
      username,
      amountSats: amount,
      host: demoHost,
      baseURL: apiBase,
      verifyPayment: isMock ? async () => true : undefined,
      onUnlock: () => {
        if (unlockHost) unlockHost.textContent = 'Unlocked!';
        onUnlock?.();
      }
    });

    const relays = relaysCsv ? parseRelays(relaysCsv) : relaysEnvDefault;

    mountCommentWidget(commentsHost, {
      threadId: 'demo-thread',
      relays,
      onRelayInfo: (info: RelayInfo) => {
        if (!relayStatus) return;
        const list = info.relays.length ? info.relays.join(', ') : 'mock';
        relayStatus.textContent = '';
        const badge = document.createElement('span');
        badge.className = 'relay-pill';
        const dot = document.createElement('span');
        dot.className = `dot ${info.mode}`;
        badge.appendChild(dot);
        const label = document.createElement('span');
        label.textContent = list;
        badge.appendChild(label);
        relayStatus.appendChild(badge);
      }
    });
  }, [username, amount, relaysCsv, onUnlock]);
}

export default function App() {
  const [username, setUsername] = useState('alice');
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [relaysCsv, setRelaysCsv] = useState(relaysEnvDefault.join(','));
  const [mockInvoice, setMockInvoice] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [realInvoice, setRealInvoice] = useState<string | null>(null);
  const [realBusy, setRealBusy] = useState(false);
  const [health, setHealth] = useState<Health[]>([
    { label: 'API', status: apiBase === 'mock' ? 'mock' : 'unknown' },
    { label: 'LNbits', status: apiBase === 'mock' ? 'mock' : 'unknown' }
  ]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(RELAY_STORAGE_KEY) : null;
    if (saved) setRelaysCsv(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (relaysCsv) {
      window.localStorage.setItem(RELAY_STORAGE_KEY, relaysCsv);
    } else {
      window.localStorage.removeItem(RELAY_STORAGE_KEY);
    }
  }, [relaysCsv]);

  useEffect(() => {
    autoMount();
  }, []);

  useEffect(() => {
    setLocked(true);
  }, [username, amount, relaysCsv]);

  useEffect(() => {
    const fetchHealth = async () => {
      if (apiBase === 'mock') return;
      const results: Health[] = [];
      try {
        const apiRes = await fetch(`${apiBase}/health`);
        results.push({ label: 'API', status: apiRes.ok ? 'ok' : 'fail', detail: `http ${apiRes.status}` });
      } catch (err) {
        results.push({ label: 'API', status: 'error', detail: formatError(err) });
      }
      try {
        const lnRes = await fetch(`${apiBase}/health/lnbits`);
        const body = await lnRes.json();
        results.push({ label: 'LNbits', status: body.status ?? (lnRes.ok ? 'ok' : 'fail'), detail: body.reason || body.error || `http ${lnRes.status}` });
      } catch (err) {
        results.push({ label: 'LNbits', status: 'error', detail: formatError(err) });
      }
      setHealth(results);
    };
    fetchHealth();
  }, []);

  const handleUnlocked = useCallback(() => setLocked(false), []);
  useMountWidgets(username, amount, relaysCsv, handleUnlocked);

  const themeStyles = useMemo(
    () =>
      theme === 'dark'
        ? { background: '#0f172a', color: '#e2e8f0', borderColor: '#334155' }
        : { background: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' },
    [theme]
  );

  const makeBolt = useCallback(() => 'lntbs1u1p5demo' + Math.random().toString(16).slice(2), []);

  const requestRealInvoice = useCallback(async () => {
    setRealBusy(true);
    setRealInvoice(null);
    try {
      const res = await fetch(`${apiBase}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', host: demoHost },
        body: JSON.stringify({
          domain: demoHost,
          action: 'tip',
          amount: amount,
          metadata: { ui: 'gallery' }
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const pr = body.payment_request ?? body.pr;
      setRealInvoice(pr || 'invoice unavailable');
    } catch (err: unknown) {
      setRealInvoice(`error: ${formatError(err)}`);
    } finally {
      setRealBusy(false);
    }
  }, [amount]);

  const walletKey = (import.meta.env.VITE_LNBITS_ADMIN_KEY ?? '').slice(0, 4) ? lnbitsAdminKey : '';

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: themeStyles.background,
        color: themeStyles.color,
        minHeight: '100vh'
      }}
    >
      <h1 style={{ marginTop: 0 }}>nostrstack Demo</h1>
      <p>Play with the widgets below. Host is assumed to be {demoHost} for local dev.</p>
      <WalletPanel lnbitsUrl={lnbitsUrl} adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'} visible />
      {!enableReal && (
        <div style={{ padding: '0.75rem 1rem', background: '#fff3c4', color: '#7c4400', borderRadius: 10, marginBottom: '1rem' }}>
          Real payments are disabled. Set VITE_ENABLE_REAL_PAYMENTS=true and provide VITE_API_BASE_URL to request real invoices.
        </div>
      )}

      <Card title="Config">
        <label>
          Username:&nbsp;
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Amount (sats):&nbsp;
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Theme:&nbsp;
          <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Relays (comments):&nbsp;
          <input
            style={{ width: '18rem' }}
            value={relaysCsv}
            onChange={(e) => setRelaysCsv(e.target.value)}
            placeholder="mock or wss://relay1,wss://relay2"
          />
        </label>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
          Using relays: {relaysCsv || relaysEnvDefault.join(',') || 'mock'} {relaysCsv.includes('mock') ? '(mock mode)' : ''}
        </div>
      </Card>

      <Card title="Tip button">
        <div id="tip-container" />
        <button data-testid="mock-tip" onClick={() => setMockInvoice(makeBolt())} style={{ marginTop: '0.5rem' }}>
          Generate tip invoice (mock)
        </button>
        {mockInvoice && (
          <div data-testid="invoice" style={{ marginTop: '0.5rem' }}>
            <strong>BOLT11</strong>
            <pre>{mockInvoice}</pre>
          </div>
        )}
        {enableReal && (
          <div style={{ marginTop: '0.75rem' }}>
            <button onClick={requestRealInvoice} disabled={realBusy}>
              {realBusy ? 'Requesting…' : `Request real invoice (${amount} sats)`}
            </button>
            {realInvoice && (
              <div data-testid="real-invoice" style={{ marginTop: '0.5rem' }}>
                <strong>BOLT11</strong>
                <pre>{realInvoice}</pre>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Pay to unlock">
        <div id="pay-container" />
        <div id="unlock-status" style={{ marginTop: '0.5rem' }} data-testid="unlock-status">
          {locked ? 'Locked' : 'Unlocked!'}
        </div>
        <button
          data-testid="mock-unlock"
          onClick={() => {
            setMockInvoice(makeBolt());
            setLocked(false);
          }}
        >
          Simulate unlock (mock)
        </button>
      </Card>

      <Card title="Comments (Nostr)">
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
          Posting to real relays needs a NIP-07 signer. Don’t have one?{' '}
          <a href="https://getalby.com" target="_blank" rel="noreferrer">Get Alby</a> or use{' '}
          <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noreferrer">nos2x</a>. For offline/mock comments, set relays to <code>mock</code>.
        </div>
        <div id="relay-status" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#334155' }} />
        <div id="comments-container" />
      </Card>

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>Build: {import.meta.env.VITE_APP_COMMIT ?? 'dev'} • {import.meta.env.VITE_APP_BUILD_TIME ?? 'now'}</span>
        {health.map((h) => (
          <span key={h.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: h.status === 'ok' ? '#22c55e' : h.status === 'mock' ? '#94a3b8' : '#ef4444',
              boxShadow: h.status === 'ok' ? '0 0 0 6px rgba(34,197,94,0.25)' : 'none'
            }} />
            <span>{h.label}: {h.status}</span>
            {h.detail ? <span style={{ color: '#94a3b8' }}>({h.detail})</span> : null}
          </span>
        ))}
      </div>

      <style>{`
        button { cursor: pointer; }
        input, select, button, textarea { background: ${theme === 'dark' ? '#1e293b' : '#fff'}; color: ${themeStyles.color}; border: 1px solid ${themeStyles.borderColor}; border-radius: 8px; padding: 0.5rem 0.75rem; }
        section { border-color: ${themeStyles.borderColor}; }
        .relay-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; border-radius: 999px; background: #f1f5f9; color: #0f172a; font-size: 12px; border: 1px solid #e2e8f0; }
        .relay-pill .dot { width: 8px; height: 8px; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 0 0 rgba(148,163,184,0.6); animation: pulse 2s infinite; }
        .relay-pill .dot.real { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
        .relay-pill .dot.mock { background: #94a3b8; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6);} 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
      `}</style>
    </main>
  );
}
