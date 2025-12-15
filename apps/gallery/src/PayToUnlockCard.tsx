import { resolvePayWsUrl } from '@nostrstack/embed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BrandedQr } from './BrandedQr';
import { CopyButton } from './CopyButton';
import { JsonView } from './ui/JsonView';

const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

type PayWsState = 'idle' | 'connecting' | 'open' | 'error';

export type PayToUnlockCardProps = {
  apiBase: string;
  host: string;
  amountSats: number;
  onPayWsState?: (state: PayWsState) => void;
};

function apiUrl(apiBase: string, path: string) {
  const base = apiBase.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function normalizeInvoice(pr: string | null | undefined) {
  if (!pr) return null;
  return pr.trim().replace(/^(?:lightning:)+/i, '');
}

export function PayToUnlockCard({ apiBase, host, amountSats, onPayWsState }: PayToUnlockCardProps) {
  const [locked, setLocked] = useState(true);
  const [status, setStatus] = useState<'idle' | 'creating' | 'pending' | 'paid' | 'error'>('idle');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [providerRef, setProviderRef] = useState<string | null>(null);
  const [wsState, setWsState] = useState<PayWsState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastCreateResponse, setLastCreateResponse] = useState<unknown | null>(null);
  const [lastStatusResponse, setLastStatusResponse] = useState<unknown | null>(null);
  const [lastWsMessage, setLastWsMessage] = useState<unknown | null>(null);
  const createdAtRef = useRef<number | null>(null);
  const [ageMs, setAgeMs] = useState(0);

  const wsUrl = useMemo(() => resolvePayWsUrl(apiBase), [apiBase]);
  const prettyInvoice = useMemo(() => {
    if (!invoice) return null;
    const head = invoice.slice(0, 18);
    const tail = invoice.length > 24 ? invoice.slice(-10) : '';
    return tail ? `${head}…${tail}` : invoice;
  }, [invoice]);

  const reset = useCallback(() => {
    setLocked(true);
    setStatus('idle');
    setInvoice(null);
    setProviderRef(null);
    setWsState('idle');
    setError(null);
    setLastCreateResponse(null);
    setLastStatusResponse(null);
    setLastWsMessage(null);
    createdAtRef.current = null;
    setAgeMs(0);
  }, []);

  useEffect(() => {
    reset();
  }, [amountSats, host, reset]);

  useEffect(() => {
    onPayWsState?.(wsState);
  }, [wsState, onPayWsState]);

  useEffect(() => {
    if (!invoice) return;
    const startedAt = Date.now();
    createdAtRef.current = startedAt;
    setAgeMs(0);
    const id = window.setInterval(() => setAgeMs(Date.now() - startedAt), 500);
    return () => window.clearInterval(id);
  }, [invoice]);

  const markPaid = useCallback(
    (source: 'ws' | 'poll') => {
      setLocked(false);
      setStatus('paid');
      setError(null);
      if (source === 'poll') {
        // if polling saw it first, keep ws state as-is; no-op
      }
    },
    [setLocked, setStatus]
  );

  const poll = useCallback(async () => {
    if (!providerRef) return false;
    try {
      const res = await fetch(
        apiUrl(
          apiBase,
          `/api/lnurlp/pay/status/${encodeURIComponent(providerRef)}?domain=${encodeURIComponent(host)}`
        )
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      setLastStatusResponse({ http: res.status, body });
      const s = String(body.status ?? '').toUpperCase();
      if (PAID_STATES.has(s)) {
        markPaid('poll');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [apiBase, host, providerRef, markPaid]);

  useEffect(() => {
    if (!invoice || status !== 'pending' || !wsUrl) return;
    setWsState('connecting');
    const ws = new WebSocket(wsUrl);
    let closed = false;
    ws.onopen = () => {
      if (!closed) setWsState('open');
    };
    ws.onerror = () => {
      if (!closed) setWsState('error');
    };
    ws.onclose = () => {
      if (!closed) setWsState((prev) => (prev === 'error' ? prev : 'idle'));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as {
          type?: string;
          pr?: string;
          providerRef?: string;
          provider_ref?: string;
        };
        setLastWsMessage(msg);
        const msgProviderRef =
          (typeof msg.providerRef === 'string' ? msg.providerRef : null) ??
          (typeof msg.provider_ref === 'string' ? msg.provider_ref : null);
        const msgInvoice = normalizeInvoice(msg.pr);
        if (
          msg.type === 'invoice-paid' &&
          ((msgInvoice && msgInvoice === invoice) || (msgProviderRef && msgProviderRef === providerRef))
        ) {
          markPaid('ws');
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => {
      closed = true;
      // Avoid InvalidStateError: WebSocket is already in CLOSING or CLOSED state.
      if (ws.readyState === WebSocket.CONNECTING) {
        const pending = ws;
        pending.onopen = () => {
          try {
            if (pending.readyState === WebSocket.OPEN) pending.close();
          } catch {
            /* ignore */
          }
        };
        pending.onmessage = null;
        pending.onerror = null;
        pending.onclose = null;
        return;
      }
      try {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [invoice, providerRef, status, wsUrl, markPaid]);

  useEffect(() => {
    if (!providerRef || status !== 'pending') return;
    let alive = true;
    // quick first poll (in case payment already happened)
    poll();
    const id = window.setInterval(async () => {
      if (!alive) return;
      const ok = await poll();
      if (ok) {
        alive = false;
        window.clearInterval(id);
      }
    }, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [providerRef, status, poll]);

  const unlock = useCallback(async () => {
    setError(null);
    setLocked(true);
    setStatus('creating');
    setInvoice(null);
    setProviderRef(null);
    setAgeMs(0);
    createdAtRef.current = null;
    setLastCreateResponse(null);
    try {
      if (apiBase === 'mock') {
        const pr =
          'lnbcrt10u1p5demoqqpp5v9l8v0h3a4g6w2xk8v4m9y3n0n8s7g6f5d4c3b2a1q0p9sdpq2p5x7ar9v3jhxapqd9h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wgsx7en0d3h8vmmfvdjjqen0wg';
        const ref = `mock-${Date.now()}`;
        setLastCreateResponse({ http: 200, body: { payment_request: pr, provider_ref: ref, mock: true } });
        setInvoice(pr);
        setProviderRef(ref);
        setStatus('pending');
        return;
      }
      const res = await fetch(apiUrl(apiBase, '/api/pay'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: host,
          action: 'unlock',
          amount: amountSats,
          metadata: { ui: 'gallery', path: 'secrets/regtest.txt' }
        })
      });
      const body = (await res.json()) as Record<string, unknown>;
      setLastCreateResponse({ http: res.status, body });
      if (!res.ok) throw new Error(String(body.error ?? body.message ?? `HTTP ${res.status}`));

      const pr = normalizeInvoice((body.payment_request as string | undefined) ?? (body.pr as string | undefined));
      const ref =
        (body.provider_ref as string | undefined) ??
        (body.providerRef as string | undefined) ??
        (body.payment_hash as string | undefined) ??
        null;
      if (!pr || !ref) throw new Error('Invoice not returned by API');
      setInvoice(pr);
      setProviderRef(ref);
      setStatus('pending');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [amountSats, apiBase, host]);

  const canRetry = status === 'error' || status === 'idle';
  const stale = status === 'pending' && ageMs > 120_000;
  const prettyAge = useMemo(() => {
    const secs = Math.max(0, Math.floor(ageMs / 1000));
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [ageMs]);

  const statusLabel =
    status === 'paid'
      ? 'Unlocked'
      : stale
        ? 'Invoice expired'
        : status === 'pending'
          ? 'Waiting for payment'
          : status === 'creating'
            ? 'Creating invoice…'
            : status === 'error'
              ? 'Payment error'
              : 'Locked';

  const wsLabel =
    wsState === 'open'
      ? 'Realtime: connected'
      : wsState === 'connecting'
        ? 'Realtime: connecting…'
        : wsState === 'error'
          ? 'Realtime: error'
          : 'Realtime: idle';

  const primaryLabel =
    status === 'paid'
      ? 'New invoice'
      : status === 'creating'
        ? 'Creating…'
        : status === 'pending'
          ? 'Waiting…'
          : `Unlock (${amountSats} sats)`;

  return (
    <div className="nostrstack-paywall" data-state={status} data-ws={wsState}>
      <div className="nostrstack-paywall__top">
        <div className="nostrstack-paywall__copy">
          <div className="nostrstack-paywall__title">Unlock secrets/regtest.txt</div>
          <div className="nostrstack-paywall__subtitle">
            Pay <strong>{amountSats} sats</strong>. Unlocks automatically on confirmation.
          </div>
        </div>
        <div className="nostrstack-paywall__badges">
          <span className={locked ? 'pay-status pay-status--pending' : 'pay-status pay-status--paid'}>
            <span className="dot" />
            {statusLabel}
          </span>
          <span className="nostrstack-paywall__ws" aria-label="WebSocket status">
            {wsLabel}
          </span>
        </div>
      </div>

      <div className="nostrstack-paywall__panel">
        <div className="nostrstack-paywall__qr">
          {status === 'paid' && !invoice ? (
            <div className="nostrstack-paywall__qrnotice">
              <strong>Unlocked</strong>
              <span>Payment confirmed.</span>
            </div>
          ) : invoice ? (
            <div className="nostrstack-paywall__qrimg" draggable={false}>
              <BrandedQr value={invoice} preset="brandLogo" verify="strict" size={260} />
            </div>
          ) : (
            <div className="nostrstack-paywall__qrskeleton" aria-hidden="true" />
          )}
        </div>

        <div className="nostrstack-paywall__details">
          <div className="nostrstack-paywall__row">
            <div className="nostrstack-paywall__k">Status</div>
            <div className="nostrstack-paywall__v">
              <span data-testid="unlock-status">{locked ? 'Locked' : 'Unlocked!'}</span>
              {status === 'pending' && (
                <span className="nostrstack-paywall__timer" title="Time since invoice created">
                  · {prettyAge}
                </span>
              )}
            </div>
          </div>

          {invoice && (
            <>
              <div className="nostrstack-paywall__row">
                <div className="nostrstack-paywall__k">Invoice</div>
                <div className="nostrstack-paywall__v">
                  <code className="nostrstack-paywall__invoice" title={invoice}>
                    {prettyInvoice}
                  </code>
                </div>
              </div>

              <div className="nostrstack-paywall__actions">
                <CopyButton text={invoice} label="Copy invoice" />
                <a
                  href={`lightning:${invoice}`}
                  className="nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm"
                  style={{ textDecoration: 'none' }}
                >
                  Open in wallet
                </a>
                <button
                  type="button"
                  className="nostrstack-btn nostrstack-btn--sm"
                  disabled={status !== 'pending'}
                  onClick={poll}
                >
                  I've paid
                </button>
              </div>
            </>
          )}

          {error && <div className="nostrstack-paywall__error">{error}</div>}

          <div className="nostrstack-paywall__cta">
            <button
              type="button"
              data-testid="paywall-unlock"
              className="nostrstack-btn nostrstack-btn--primary"
              disabled={status === 'creating' || status === 'pending'}
              onClick={unlock}
            >
              {primaryLabel}
            </button>

            <button
              type="button"
              className="nostrstack-btn"
              disabled={!invoice && !canRetry && status !== 'paid'}
              onClick={reset}
            >
              Reset
            </button>

            {import.meta.env.DEV && status === 'pending' && invoice && (
              <button
                type="button"
                data-testid="mock-unlock"
                className="nostrstack-btn nostrstack-btn--sm"
                onClick={() => markPaid('poll')}
              >
                Mock unlock
              </button>
            )}
          </div>
        </div>
      </div>

      {!locked && (
        <div className="nostrstack-paywall__unlocked">
          <div className="nostrstack-paywall__unlocked-title">Unlocked content</div>
          <div className="nostrstack-paywall__unlocked-body">
            <code>secrets/regtest.txt</code> — &quot;The quick brown fox pays 21 sats.&quot;
          </div>
        </div>
      )}

      <div className="nostrstack-paywall__debug">
        <JsonView title="Create invoice response" value={lastCreateResponse} maxHeight={160} />
        <JsonView title="Last status poll response" value={lastStatusResponse} maxHeight={160} />
        <JsonView title="Last WS message" value={lastWsMessage} maxHeight={160} />
      </div>
    </div>
  );
}
