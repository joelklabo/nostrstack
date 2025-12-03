import { useState } from 'react';

export function FaucetButton({ apiBase }: { apiBase: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const target = `${apiBase.replace(/\/$/, '')}/regtest/fund`;
      const res = await fetch(target, { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMsg('Funded & mined; balances updating.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMsg(`Failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <button onClick={run} disabled={busy} style={{ padding: '0.55rem 1rem' }}>
        {busy ? 'Funding…' : 'Add funds (regtest)'}
      </button>
      {msg && <span style={{ fontSize: '0.9rem', color: '#475569' }}>{msg}</span>}
    </div>
  );
}
