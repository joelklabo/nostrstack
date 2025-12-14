import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from './ui/Badge';

type TelemetryEvent =
  | {
    type: 'block';
    height: number;
    hash?: string;
    time: number;
    txs?: number;
    size?: number;
    weight?: number;
    interval?: number;
    mempoolTxs?: number;
    mempoolBytes?: number;
  }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number }
  | { type: 'error'; message: string; time: number };

type Props = { wsUrl: string; network?: string };

function normalizeTelemetryUrl(raw: string) {
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4173';
  try {
    const url = new URL(raw, fallbackOrigin);
    const pathNoSlash = url.pathname.replace(/\/$/, '');
    if (pathNoSlash === '/api/ws/telemetry') {
      url.pathname = '/ws/telemetry';
    } else if (pathNoSlash === '/api') {
      url.pathname = '/ws/telemetry';
    } else if (url.pathname === '/') {
      url.pathname = '/ws/telemetry';
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function isLocalhostUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function buildWsVariants(url: string) {
  const primary = normalizeTelemetryUrl(url);
  const variants = [primary];
  const host = (() => {
    try {
      return new URL(primary).host;
    } catch {
      return null;
    }
  })();
  const isLocal = host?.startsWith('localhost') || host?.startsWith('127.') || host?.startsWith('[::1]');
  if (primary.startsWith('wss://') && isLocal) {
    variants.push(primary.replace(/^wss:/, 'ws:'));
  }
  if (isLocal && host !== 'localhost:3001') {
    variants.push('ws://localhost:3001/ws/telemetry');
  }
  return variants;
}

function mixedContentBlock(url: string) {
  if (typeof window === 'undefined') return null;
  if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
    return 'Blocked by browser: insecure ws:// from an HTTPS page. Use wss:// or load the app over http://.';
  }
  return null;
}

function describeWsError(ev: Event) {
  if (ev instanceof ErrorEvent && ev.message) return ev.message;
  return ev.type || 'error';
}

function suggestFix(url: string, err: string | null) {
  const isLocal = isLocalhostUrl(url);
  if (url.startsWith('wss://') && isLocal) {
    return 'Self-signed localhost cert? Open the URL in a new tab and accept the certificate, then retry.';
  }
  if (err?.includes('blocked') && url.startsWith('ws://') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'Page is HTTPS so ws:// is blocked; use wss:// or load the app over http://localhost.';
  }
  return null;
}

export function BlockList({ wsUrl, network = 'regtest' }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [now, setNow] = useState(Date.now());
  const [blockFlashKey, setBlockFlashKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backendIssue, setBackendIssue] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string>(wsUrl);
  const [attemptNote, setAttemptNote] = useState<string | null>(null);
  const backoffRef = useRef(1500);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let healthOk = false;
    const variants = buildWsVariants(wsUrl);
    let variantIdx = 0;
    backoffRef.current = 1400;

    const clearRetry = () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const connect = async () => {
      if (cancelled) return;
      clearRetry();

      // lightweight health probe to avoid noisy failed handshakes when API isn't up yet
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        healthOk = res.ok;
      } catch {
        healthOk = false;
      }

      if (!healthOk) {
        setStatus('error');
        setErrorMsg('API health check failed; waiting to retry…');
        retryRef.current = setTimeout(connect, 2000);
        return;
      }

      const target = variants[variantIdx];
      if (!target) {
        setStatus('error');
        setErrorMsg('No telemetry endpoint available');
        return;
      }

      const mixed = mixedContentBlock(target);
      if (mixed) {
        setStatus('error');
        setErrorMsg(mixed);
        if (variantIdx < variants.length - 1) {
          variantIdx += 1;
          setAttemptNote('HTTPS blocked ws://; trying fallback');
          connect();
        }
        return;
      }

      setStatus('connecting');
      setAttemptNote(variantIdx > 0 ? 'Using fallback endpoint' : null);
      setActiveUrl(target);
      setErrorMsg(null);

      let opened = false;
      const ws = new WebSocket(target);
      wsRef.current = ws;

      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as TelemetryEvent;
          if (ev.type === 'error') {
            setBackendIssue(ev.message || 'Telemetry backend error');
            return;
          }
          if (ev.type === 'block' && typeof ev.height === 'number') {
            setHeight(ev.height);
            setBlockFlashKey(eventKey(ev));
            setBackendIssue(null);
          }
          setEvents((prev) => {
            const key = eventKey(ev);
            if (prev.some((p) => eventKey(p) === key)) return prev;
            return [ev, ...prev].slice(0, 24);
          });
        } catch (err) {
          console.warn('telemetry parse', err);
        }
      };
      ws.onopen = () => {
        opened = true;
        setStatus('open');
        backoffRef.current = 1500;
        setErrorMsg(null);
      };
      ws.onerror = (e) => {
        const msg = describeWsError(e as Event);
        if (!opened && variantIdx < variants.length - 1) {
          setErrorMsg(`Handshake failed (${msg})`);
          variantIdx += 1;
          ws.close();
          return;
        }
        setStatus('error');
        setErrorMsg(msg || 'connection error');
      };
      ws.onclose = (e) => {
        if (cancelled) return;
        if (!opened && variantIdx < variants.length - 1) {
          variantIdx += 1;
          setAttemptNote('Switching to fallback endpoint');
          setErrorMsg(`Closed (${e.code}); retrying…`);
          setTimeout(connect, 75);
          return;
        }
        setStatus('error');
        const msg = `closed (${e.code})`;
        setErrorMsg(msg);
        const jitter = 0.6 + Math.random() * 0.8; // 0.6x–1.4x jitter
        const delay = Math.min(15000, Math.round(backoffRef.current * jitter));
        backoffRef.current *= 1.6;
        retryRef.current = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        // abort in-flight connection politely
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }
      clearRetry();
    };
  }, [wsUrl]);

  const tone = useMemo(() => {
    if (status === 'open') {
      return {
        label: 'Streaming',
        bg: 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))',
        fg: 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))',
        dot: 'var(--nostrstack-color-success)',
        border: 'color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border))'
      };
    }
    if (status === 'connecting') {
      return {
        label: 'Connecting…',
        bg: 'color-mix(in oklab, var(--nostrstack-color-warning) 14%, var(--nostrstack-color-surface))',
        fg: 'color-mix(in oklab, var(--nostrstack-color-warning) 70%, var(--nostrstack-color-text))',
        dot: 'var(--nostrstack-color-warning)',
        border: 'color-mix(in oklab, var(--nostrstack-color-warning) 35%, var(--nostrstack-color-border))'
      };
    }
    if (status === 'error') {
      return {
        label: 'Disconnected',
        bg: 'color-mix(in oklab, var(--nostrstack-color-danger) 14%, var(--nostrstack-color-surface))',
        fg: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
        dot: 'var(--nostrstack-color-danger)',
        border: 'color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))'
      };
    }
    return {
      label: 'Idle',
      bg: 'var(--nostrstack-color-surface-strong)',
      fg: 'var(--nostrstack-color-text-muted)',
      dot: 'var(--nostrstack-color-text-subtle)',
      border: 'var(--nostrstack-color-border)'
    };
  }, [status]);

  const blockEvents = useMemo(
    () => events.filter(isBlockEvent).sort((a, b) => (b.height ?? 0) - (a.height ?? 0)).slice(0, 8),
    [events]
  );

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
          <span>Telemetry</span>
          <Badge tone="accent">{network.toUpperCase()}</Badge>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--nostrstack-radius-pill)',
              background: tone.bg,
              color: tone.fg,
              border: `1px solid ${tone.border}`
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 'var(--nostrstack-radius-pill)',
                background: tone.dot,
                animation: status === 'open' ? 'nostrstack-pulse-soft 1.8s infinite' : 'none',
                ...(status === 'open' ? ({ '--nostrstack-pulse-color': tone.dot } as Record<string, string>) : {})
              } as React.CSSProperties}
            />
            {tone.label}
          </span>
        </div>
        <span style={{ fontSize: '0.95rem', color: 'var(--nostrstack-color-text-muted)' }}>
          Height: {height ?? '…'}
        </span>
      </div>
      <div
        style={{
          fontSize: '0.9rem',
          color: 'var(--nostrstack-color-text-muted)',
          display: 'flex',
          gap: '0.45rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <span style={{ fontWeight: 700 }}>Endpoint</span>
        <code
          style={{
            background: 'var(--nostrstack-color-surface-strong)',
            border: '1px solid var(--nostrstack-color-border)',
            padding: '0.2rem 0.4rem',
            borderRadius: 'var(--nostrstack-radius-sm)'
          }}
        >
          {activeUrl}
        </code>
        {attemptNote && (
          <span style={{ color: 'color-mix(in oklab, var(--nostrstack-color-warning) 75%, var(--nostrstack-color-text))' }}>
            {attemptNote}
          </span>
        )}
      </div>
      {backendIssue && (
        <div
          style={{
            fontSize: '0.9rem',
            color: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
            background:
              'color-mix(in oklab, var(--nostrstack-color-danger) 12%, var(--nostrstack-color-surface))',
            border:
              '1px solid color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
            padding: '0.45rem 0.6rem',
            borderRadius: 'var(--nostrstack-radius-md)',
            display: 'grid',
            gap: 4
          }}
        >
          <span>Telemetry backend issue: {backendIssue}</span>
          <span style={{ color: 'color-mix(in oklab, var(--nostrstack-color-danger) 80%, var(--nostrstack-color-text))' }}>
            Check API logs (.logs/dev/api.log) and bitcoind RPC health.
          </span>
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            fontSize: '0.9rem',
            color: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
            background:
              'color-mix(in oklab, var(--nostrstack-color-danger) 12%, var(--nostrstack-color-surface))',
            border:
              '1px solid color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
            padding: '0.45rem 0.6rem',
            borderRadius: 'var(--nostrstack-radius-md)',
            display: 'grid',
            gap: 4
          }}
        >
          <span>Stream error: {errorMsg ?? 'disconnected'} — retrying…</span>
          {suggestFix(activeUrl, errorMsg)?.length ? (
            <span style={{ color: 'color-mix(in oklab, var(--nostrstack-color-danger) 80%, var(--nostrstack-color-text))' }}>
              {suggestFix(activeUrl, errorMsg)}
            </span>
          ) : null}
          <span style={{ color: 'color-mix(in oklab, var(--nostrstack-color-danger) 80%, var(--nostrstack-color-text))' }}>
            If you are in dev, ensure API is running (`pnpm dev:logs`) and check API logs for `/ws/telemetry` errors.
          </span>
        </div>
      )}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(360px, 1fr)' }}>
        <div
          className="nostrstack-card"
          style={{
            borderRadius: 'var(--nostrstack-radius-lg)',
            overflow: 'hidden',
            background: 'var(--nostrstack-color-surface)',
            boxShadow: 'var(--nostrstack-shadow-md)'
          }}
        >
          <div style={{ padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 90px 140px', gap: 8, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nostrstack-color-text-subtle)', background: 'var(--nostrstack-color-surface-strong)' }}>
            <span>Height</span>
            <span>Txs</span>
            <span>Size</span>
            <span>Weight</span>
            <span>Since</span>
            <span>Hash</span>
          </div>
          {blockEvents.length === 0 ? (
            <div style={{ padding: '0.9rem 1rem', color: 'var(--nostrstack-color-text-muted)' }}>
              Waiting for blocks…
            </div>
          ) : (
            blockEvents.map((b) => (
              <BlockRow key={eventKey(b)} block={b} isNew={blockFlashKey === eventKey(b)} now={now} />
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideDown { 0% { transform: translateY(-6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

function eventKey(ev: TelemetryEvent) {
  if (ev.type === 'block') return `block-${ev.height}-${ev.hash ?? ''}`;
  if (ev.type === 'tx') return `tx-${ev.txid}`;
  if (ev.type === 'lnd') return `lnd-${ev.role}-${ev.event}-${ev.time}`;
  return `error-${ev.time}-${ev.message}`;
}

type BlockEvent = Extract<TelemetryEvent, { type: 'block' }>;

function BlockRow({ block, isNew, now }: { block: BlockEvent; isNew: boolean; now: number }) {
  const since = Math.max(0, Math.floor((now - block.time * 1000) / 1000));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 80px 90px 90px 140px',
        gap: 8,
        padding: '0.65rem 1rem',
        alignItems: 'center',
        borderTop: '1px solid color-mix(in oklab, var(--nostrstack-color-border) 55%, transparent)',
        background: isNew
          ? 'color-mix(in oklab, var(--nostrstack-color-info) 12%, var(--nostrstack-color-surface))'
          : 'transparent',
        animation: isNew ? 'slideDown 320ms ease-out' : undefined
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 'var(--nostrstack-radius-pill)',
            background: 'var(--nostrstack-color-success)'
          }}
        />
        <strong>#{block.height}</strong>
      </div>
      <span>{block.txs ?? '—'}</span>
      <span>{block.size != null ? `${(block.size / 1024).toFixed(1)} KB` : '—'}</span>
      <span>{block.weight ?? '—'}</span>
      <span>{formatDuration(since)}</span>
      <code style={{ color: 'var(--nostrstack-color-info)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(block.hash ?? '').slice(0, 18) || 'hash'}
      </code>
    </div>
  );
}

function isBlockEvent(ev: TelemetryEvent): ev is Extract<TelemetryEvent, { type: 'block' }> {
  return ev.type === 'block';
}

function formatDuration(secs: number) {
  if (!Number.isFinite(secs)) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${secs % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
