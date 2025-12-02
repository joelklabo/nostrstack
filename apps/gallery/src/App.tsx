import { autoMount, mountCommentWidget, mountPayToAction, mountTipButton } from '@nostrstack/embed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EventTemplate, finalizeEvent, getPublicKey } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

import { CopyButton } from './CopyButton';
import { FaucetButton } from './FaucetButton';
import { InvoicePopover } from './InvoicePopover';
import { WalletPanel } from './WalletPanel';

type RelayInfo = { relays: string[]; mode: 'mock' | 'real' };
type Health = { label: string; status: 'ok' | 'fail' | 'error' | 'skipped' | 'mock' | 'unknown'; detail?: string };
type CommentEvent = {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind: number;
  tags?: string[][];
  content: string;
  sig?: string;
};

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
const TEST_SIGNER_STORAGE_KEY = 'nostrstack.test-signer';
const defaultTestSignerSk = import.meta.env.VITE_TEST_SIGNER_SK ?? '2b7e151628aed2a6abf7158809cf4f3c2b7e151628aed2a6abf7158809cf4f3c';
const defaultTestSignerEnabled = import.meta.env.VITE_ENABLE_TEST_SIGNER === 'true';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e3e3e3', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

type PillTone = 'info' | 'success' | 'warn' | 'muted';

function Pill({ label, value, tone = 'info', theme }: { label: string; value: string; tone?: PillTone; theme: 'light' | 'dark' }) {
  const toneColor: Record<PillTone, string> = {
    info: '#3b82f6',
    success: '#22c55e',
    warn: '#f59e0b',
    muted: '#94a3b8'
  };
  const background = theme === 'dark' ? '#111827' : '#fff';
  const border = `${toneColor[tone]}33`;
  const textColor = theme === 'dark' ? '#e2e8f0' : '#0f172a';
  const subColor = theme === 'dark' ? '#cbd5e1' : '#475569';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color: textColor,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      <span style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: subColor, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </span>
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

function compactRelaysLabel(relays: string, max = 32) {
  if (relays.length <= max) return relays;
  return `${relays.slice(0, max)}…`;
}

const tabBtn = (active: boolean, themeStyles: { background: string; color: string; borderColor: string }) => ({
  padding: '0.55rem 1.1rem',
  borderRadius: 10,
  border: `1px solid ${themeStyles.borderColor}`,
  background: active ? '#0ea5e9' : themeStyles.background,
  color: active ? '#fff' : themeStyles.color,
  fontWeight: 700,
  boxShadow: active ? '0 6px 20px rgba(14,165,233,0.25)' : 'none'
});

function useMountWidgets(username: string, amount: number, relaysCsv: string, onUnlock: () => void, enableTestSigner: boolean, setQrInvoice: (pr: string | null) => void, setQrAmount: (n?: number) => void) {
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

    const tipOpts: any = {
      username,
      amountSats: amount,
      host: demoHost,
      baseURL: apiBase,
      onInvoice: (pr: string) => {
        setQrInvoice(pr);
        setQrAmount(amount);
      }
    };
    mountTipButton(tipHost, tipOpts);
    mountPayToAction(payHost, {
      username,
      amountSats: amount,
      host: demoHost,
      baseURL: apiBase,
      onInvoice: (pr) => {
        setQrInvoice(pr);
        setQrAmount(amount);
      },
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
  }, [username, amount, relaysCsv, onUnlock, enableTestSigner]);
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
  const [qrInvoice, setQrInvoice] = useState<string | null>(null);
  const [qrAmount, setQrAmount] = useState<number | undefined>(undefined);
  const [tab, setTab] = useState<'lightning' | 'nostr'>('lightning');
  const [health, setHealth] = useState<Health[]>([
    { label: 'API', status: apiBase === 'mock' ? 'mock' : 'unknown' },
    { label: 'LNbits', status: apiBase === 'mock' ? 'mock' : 'unknown' }
  ]);
  const [enableTestSigner, setEnableTestSigner] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultTestSignerEnabled;
    const stored = window.localStorage.getItem(TEST_SIGNER_STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
    return defaultTestSignerEnabled;
  });

  const testSignerPub = useMemo(() => {
    try {
      return getPublicKey(defaultTestSignerSk);
    } catch (err) {
      console.warn('invalid test signer key', err);
      return null;
    }
  }, [defaultTestSignerSk]);

  const nostrBackup = useRef<typeof window.nostr>();
  const nostrToolsBackup = useRef<typeof window.NostrTools>();

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(RELAY_STORAGE_KEY) : null;
    if (saved) setRelaysCsv(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TEST_SIGNER_STORAGE_KEY, enableTestSigner ? 'on' : 'off');
  }, [enableTestSigner]);

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
    if (typeof window === 'undefined') return;
    if (enableTestSigner && !testSignerPub) return;

    if (enableTestSigner && testSignerPub) {
      if (nostrBackup.current === undefined) nostrBackup.current = window.nostr;
      if (nostrToolsBackup.current === undefined) nostrToolsBackup.current = window.NostrTools;
      const signEvent = async (event: CommentEvent) => {
        const template: EventTemplate = {
          kind: event.kind,
          created_at: event.created_at ?? Math.floor(Date.now() / 1000),
          tags: event.tags ?? [],
          content: event.content
        };
        return finalizeEvent(template, defaultTestSignerSk);
      };
      window.nostr = {
        getPublicKey: async () => testSignerPub,
        signEvent
      };
      window.NostrTools = { ...(window.NostrTools ?? {}), relayInit: (url: string) => new Relay(url) };
    }

    if (!enableTestSigner && nostrBackup.current !== undefined) {
      window.nostr = nostrBackup.current;
      window.NostrTools = nostrToolsBackup.current;
    }

    return () => {
      if (nostrBackup.current !== undefined) {
        window.nostr = nostrBackup.current;
      }
      if (nostrToolsBackup.current !== undefined) {
        window.NostrTools = nostrToolsBackup.current;
      }
    };
  }, [enableTestSigner, testSignerPub, defaultTestSignerSk]);

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
  useMountWidgets(username, amount, relaysCsv, handleUnlocked, enableTestSigner, setQrInvoice, setQrAmount);

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
    setQrInvoice(null);
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
      setQrInvoice(pr);
      setQrAmount(amount);
      setRealInvoice(pr || 'invoice unavailable');
    } catch (err: unknown) {
      setRealInvoice(`error: ${formatError(err)}`);
    } finally {
      setRealBusy(false);
    }
  }, [amount]);

  const walletKey = (import.meta.env.VITE_LNBITS_ADMIN_KEY ?? '').slice(0, 4) ? lnbitsAdminKey : '';
  const relayMode = relaysCsv.includes('mock') ? 'mock' : 'real';
  const relayLabel = relaysCsv || relaysEnvDefault.join(',') || 'mock';
  const isDark = theme === 'dark';

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
      <p style={{ maxWidth: 780 }}>
        Play with the widgets below. Lightning points at <strong>{demoHost}</strong>; comments use the relays you set.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={() => setTab('lightning')} style={tabBtn(tab === 'lightning', themeStyles)}>Lightning</button>
        <button onClick={() => setTab('nostr')} style={tabBtn(tab === 'nostr', themeStyles)}>Nostr</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Pill label="Host" value={demoHost} tone={isMock ? 'muted' : 'info'} theme={theme} />
        <Pill label="API" value={apiBase === 'mock' ? 'mock' : apiBase} tone={apiBase === 'mock' ? 'muted' : 'info'} theme={theme} />
        <Pill label="Payments" value={enableReal ? 'real invoices' : 'mock only'} tone={enableReal ? 'success' : 'warn'} theme={theme} />
        <Pill label="Comments" value={relayMode === 'mock' ? 'mock relays' : 'real Nostr'} tone={relayMode === 'mock' ? 'muted' : 'success'} theme={theme} />
        <Pill label="Relays" value={compactRelaysLabel(relayLabel)} tone="info" theme={theme} />
      </div>

      <WalletPanel lnbitsUrl={lnbitsUrl} adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'} visible />
      {!enableReal && (
        <div style={{ padding: '0.75rem 1rem', background: '#fff3c4', color: '#7c4400', borderRadius: 10, marginBottom: '1rem' }}>
          Real payments are disabled. Set VITE_ENABLE_REAL_PAYMENTS=true and provide VITE_API_BASE_URL to request real invoices.
        </div>
      )}

      {tab === 'lightning' && (
      <>
      <div style={{ marginBottom: '1rem' }}>
        <FaucetButton apiBase={apiBase} />
      </div>
      <Card title="Config & presets">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Amount (sats)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Relays (comments)</span>
            <input
              style={{ width: '100%' }}
              value={relaysCsv}
              onChange={(e) => setRelaysCsv(e.target.value)}
              placeholder="mock or wss://relay1,wss://relay2"
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setRelaysCsv(relaysEnvDefault.join(','))}>Use real defaults</button>
            <button type="button" onClick={() => setRelaysCsv('mock')}>Use mock/offline</button>
            <CopyButton text={relayLabel} label="Copy relays" />
          </div>
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            Using: {relayLabel} {relayMode === 'mock' ? '(mock mode: local only)' : '(real Nostr relays)'}
          </div>
        </div>

        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            border: `1px dashed ${themeStyles.borderColor}`,
            borderRadius: 10,
            background: isDark ? '#0b1220' : '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={enableTestSigner}
              onChange={(e) => setEnableTestSigner(e.target.checked)}
              disabled={!testSignerPub}
            />
            Built-in Nostr test signer (regtest/CI)
          </label>
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            Deterministic key for posting to real relays. Test-only; do not use on mainnet.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <span>Pubkey: <code>{testSignerPub ? `${testSignerPub.slice(0, 12)}…${testSignerPub.slice(-6)}` : 'invalid key'}</code></span>
            {testSignerPub ? <CopyButton text={testSignerPub} label="Copy pubkey" /> : null}
            <CopyButton text={defaultTestSignerSk} label="Copy secret" />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="Tip button">
          <div style={{ marginBottom: '0.5rem', color: '#475569' }}>LNURLp flow. Mock button is instant; real invoice hits the API.</div>
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
          <div style={{ marginBottom: '0.5rem', color: '#475569' }}>Creates an invoice and unlocks after verification (mock auto-verifies).</div>
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
      </div>
      </>
      )}

      {tab === 'nostr' && (
      <Card title="Comments (Nostr)">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
          <Pill label="Mode" value={relayMode === 'mock' ? 'mock (local)' : 'real relays'} tone={relayMode === 'mock' ? 'muted' : 'success'} theme={theme} />
          <span style={{ fontSize: '0.9rem', color: '#475569' }}>Relays: {relayLabel}</span>
        </div>
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
          Posting to real relays needs a NIP-07 signer. Don’t have one?{' '}
          <a href="https://getalby.com" target="_blank" rel="noreferrer">Get Alby</a> or use{' '}
          <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noreferrer">nos2x</a>. Or flip on the built-in test signer in Config for regtest/CI. For offline/local comments, set relays to <code>mock</code> (no relay writes).
        </div>
        <div id="relay-status" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#334155' }} />
        <div id="comments-container" />
      </Card>
      )}

      <Card title="Status & build">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem', color: '#475569' }}>
          <span>Build: {import.meta.env.VITE_APP_COMMIT ?? 'dev'} • {import.meta.env.VITE_APP_BUILD_TIME ?? 'now'}</span>
          <span>Host: {demoHost}</span>
          <span>API base: {apiBase}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
          {health.map((h) => {
            const color = h.status === 'ok' ? '#22c55e' : h.status === 'mock' ? '#94a3b8' : '#ef4444';
            const bg = isDark ? '#0b1220' : '#f8fafc';
            return (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.75rem', borderRadius: 10, background: bg, border: `1px solid ${themeStyles.borderColor}` }}>
                <span
                  className={h.status === 'ok' ? 'status-dot pulse' : 'status-dot'}
                  style={{ width: 12, height: 12, borderRadius: 999, background: color }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 700 }}>{h.label}</span>
                  <span style={{ fontSize: '0.9rem', color: '#475569' }}>{h.status}{h.detail ? ` – ${h.detail}` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <style>{`
        button { cursor: pointer; }
        input, select, button, textarea { background: ${theme === 'dark' ? '#1e293b' : '#fff'}; color: ${themeStyles.color}; border: 1px solid ${themeStyles.borderColor}; border-radius: 8px; padding: 0.5rem 0.75rem; }
        section { border-color: ${themeStyles.borderColor}; }
        .relay-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; border-radius: 999px; background: #f1f5f9; color: #0f172a; font-size: 12px; border: 1px solid #e2e8f0; }
        .relay-pill .dot { width: 8px; height: 8px; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 0 0 rgba(148,163,184,0.6); animation: pulse 2s infinite; }
        .relay-pill .dot.real { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
        .relay-pill .dot.mock { background: #94a3b8; }
        .status-dot.pulse { box-shadow: 0 0 0 0 rgba(34,197,94,0.25); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6);} 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      {qrInvoice && <InvoicePopover invoice={qrInvoice} amountSats={qrAmount} onClose={() => setQrInvoice(null)} />}
    </main>
  );
}
