import { useState } from 'react';

import { JsonView } from './ui/JsonView';

export function FaucetButton({ apiBase, onFunded }: { apiBase: string; onFunded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const target = `${apiBase.replace(/\/$/, '')}/api/regtest/fund`;
      setLastRequest(`POST ${target}`);
      setLastResponse(null);
      const res = await fetch(target, { method: 'POST' });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep raw text
      }
      setLastResponse(body);
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
      const ok = Boolean(bodyObj?.ok);
      const err = typeof bodyObj?.error === 'string' ? bodyObj.error : null;
      if (!res.ok || !ok) throw new Error(err || `HTTP ${res.status}`);
      setMsg('Funded & mined; balances updating.');
      onFunded?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMsg(`Failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={run} disabled={busy} style={{ padding: '0.55rem 1rem' }}>
          {busy ? 'Funding…' : 'Add funds (regtest)'}
        </button>
        {msg && <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>{msg}</span>}
      </div>
      {lastRequest && (
        <div style={{ fontSize: '0.85rem', color: 'var(--nostrstack-color-text-subtle)' }}>
          Last request: <code>{lastRequest}</code>
        </div>
      )}
      <JsonView title="Last response" value={lastResponse} maxHeight={140} />
    </div>
  );
}
