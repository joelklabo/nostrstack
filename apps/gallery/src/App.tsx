import { autoMount, mountCommentWidget, mountPayToAction, mountTipButton } from '@nostrstack/embed';
import { WalletPanel } from './WalletPanel';
import { useEffect, useMemo, useState } from 'react';

const demoHost = import.meta.env.VITE_NOSTRSTACK_HOST ?? 'mock';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'mock';
const enableReal = import.meta.env.VITE_ENABLE_REAL_PAYMENTS === 'true';
const relaysEnvRaw = import.meta.env.VITE_NOSTRSTACK_RELAYS;
const relaysEnvDefault = relaysEnvRaw
  ? relaysEnvRaw.split(',').map((r) => r.trim()).filter(Boolean)
  : ['mock'];
const isMock = demoHost === 'mock' || apiBase === 'mock';
const lnbitsUrl = import.meta.env.VITE_LNBITS_URL ?? 'http://localhost:15001';
const lnbitsAdminKey = import.meta.env.VITE_LNBITS_ADMIN_KEY ?? 'set-me';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e3e3e3', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function App() {
  const [username, setUsername] = useState('alice');
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [relaysInput, setRelaysInput] = useState(relaysEnvDefault.join(','));
  const [realInvoice, setRealInvoice] = useState<string | null>(null);
  const [realBusy, setRealBusy] = useState(false);

  const themeStyles = useMemo(() => (
    theme === 'dark'
      ? { background: '#0f172a', color: '#e2e8f0', borderColor: '#334155' }
      : { background: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' }
  ), [theme]);

  useEffect(() => {
    autoMount();
  }, []);

  const requestRealInvoice = async () => {
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
      setRealInvoice(body.payment_request || body.pr || 'invoice unavailable');
    } catch (err: any) {
      setRealInvoice(`error: ${err?.message ?? err}`);
    } finally {
      setRealBusy(false);
    }
  };

  const walletKey = (import.meta.env.VITE_LNBITS_ADMIN_KEY ?? '').slice(0, 4) ? lnbitsAdminKey : '';

  return (
    <main style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', background: themeStyles.background, color: themeStyles.color, minHeight: '100vh' }}>
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
          <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
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
        {/* Test helper: mock invoice display */}
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
        <div id="comments-container" />
      </Card>

      <style>{`
        button { cursor: pointer; }
        input, select, button, textarea { background: ${theme === 'dark' ? '#1e293b' : '#fff'}; color: ${themeStyles.color}; border: 1px solid ${themeStyles.borderColor}; border-radius: 8px; padding: 0.5rem 0.75rem; }
        section { border-color: ${themeStyles.borderColor}; }
      `}</style>
    </main>
  );
}

function useMountWidgets(username: string, amount: number, relaysCsv: string) {
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
      onUnlock: () => unlockHost && (unlockHost.textContent = 'Unlocked!')
    });
    const relays = relaysCsv
      ? relaysCsv.split(',').map((r) => r.trim()).filter(Boolean)
      : relaysEnvDefault;

    mountCommentWidget(commentsHost, {
      threadId: 'demo-thread',
      relays: relays,
      onRelayInfo: (info) => {
        if (!relayStatus) return;
        const list = info.relays.length ? info.relays.join(', ') : 'mock';
        relayStatus.textContent = `Relays: ${list} (${info.mode})`;
      }
    });
  }, [username, amount, relaysCsv]);
}

function WrappedApp() {
  const [username, setUsername] = useState('alice');
  const [amount, setAmount] = useState(5);
  const [relaysCsv, setRelaysCsv] = useState(relaysEnvDefault.join(','));
  useMountWidgets(username, amount, relaysCsv);

  return (
    <AppWithState
      username={username}
      amount={amount}
      setUsername={setUsername}
      setAmount={setAmount}
      relaysCsv={relaysCsv}
      setRelaysCsv={setRelaysCsv}
    />
  );
}

function AppWithState(props: {
  username: string;
  amount: number;
  setUsername: (v: string) => void;
  setAmount: (n: number) => void;
  relaysCsv: string;
  setRelaysCsv: (v: string) => void;
}) {
  // reuse App but with lifted state
  const { username, amount, setUsername, setAmount, relaysCsv, setRelaysCsv } = props;
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mockInvoice, setMockInvoice] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);

  const makeBolt = () => 'lntbs1u1p5demo' + Math.random().toString(16).slice(2);
  const setMockInvoiceSafe = (s: string | null) => setMockInvoice(s);

  const themeStyles = useMemo(() => (
    theme === 'dark'
      ? { background: '#0f172a', color: '#e2e8f0', borderColor: '#334155' }
      : { background: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' }
  ), [theme]);

  useMountWidgets(username, amount);

  return (
    <main style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', background: themeStyles.background, color: themeStyles.color, minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>nostrstack Demo</h1>
      <p>Play with the widgets below. Host is assumed to be {demoHost} for local dev.</p>

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
          <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </Card>

      <Card title="Tip button">
        <div id="tip-container" />
        <button data-testid="mock-tip" onClick={() => setMockInvoiceSafe(makeBolt())} style={{ marginTop: '0.5rem' }}>
          Generate tip invoice (mock)
        </button>
        {mockInvoice && (
          <div data-testid="invoice" style={{ marginTop: '0.5rem' }}>
            <strong>BOLT11</strong>
            <pre>{mockInvoice}</pre>
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
            setMockInvoiceSafe(makeBolt());
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
        <div id="relay-status" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#334155' }}>
          Relays: {relaysCsv || relaysEnvDefault.join(',')} (pending)
        </div>
        <div id="comments-container" />
      </Card>

      <style>{`
        button { cursor: pointer; }
        input, select, button, textarea { background: ${theme === 'dark' ? '#1e293b' : '#fff'}; color: ${themeStyles.color}; border: 1px solid ${themeStyles.borderColor}; border-radius: 8px; padding: 0.5rem 0.75rem; }
        section { border-color: ${themeStyles.borderColor}; }
      `}</style>
    </main>
  );
}

export default WrappedApp;
