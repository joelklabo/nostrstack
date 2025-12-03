import { useEffect, useMemo, useRef, useState } from 'react';

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
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number };

type Props = { wsUrl: string };

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

export function TelemetryCard({ wsUrl }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [nodeInfo, setNodeInfo] = useState<{ uri?: string; ip?: string }>({});
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [now, setNow] = useState(Date.now());
  const [blockFlashKey, setBlockFlashKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
          if (ev.type === 'block' && typeof ev.height === 'number') {
            setHeight(ev.height);
            setBlockFlashKey(`${ev.height}-${ev.hash ?? 'hashless'}`);
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

  useEffect(() => {
    // TODO: fetch static node info from API once exposed
    setNodeInfo({ uri: 'lnd-merchant@localhost:9735', ip: '127.0.0.1' });
  }, []);

  const tone = useMemo(() => {
    if (status === 'open') return { label: 'Streaming', bg: '#ecfdf3', fg: '#166534', dot: '#22c55e' };
    if (status === 'connecting') return { label: 'Connecting…', bg: '#fff7ed', fg: '#c2410c', dot: '#fb923c' };
    if (status === 'error') return { label: 'Disconnected', bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' };
    return { label: 'Idle', bg: '#e2e8f0', fg: '#475569', dot: '#94a3b8' };
  }, [status]);

  const latest = events.length ? events[0] : null;
  const [blockCache, setBlockCache] = useState<Extract<TelemetryEvent, { type: 'block' }> | null>(null);

  useEffect(() => {
    const blk = events.find(isBlockEvent);
    if (blk) {
      setBlockCache((prev) => ({
        ...prev,
        ...blk,
        txs: blk.txs ?? prev?.txs,
        size: blk.size ?? prev?.size,
        weight: blk.weight ?? prev?.weight,
        mempoolTxs: blk.mempoolTxs ?? prev?.mempoolTxs,
        mempoolBytes: blk.mempoolBytes ?? prev?.mempoolBytes
      }) as Extract<TelemetryEvent, { type: 'block' }>);
    }
  }, [events]);

  const latestBlock = useMemo(() => blockCache ?? (events.find(isBlockEvent) as Extract<TelemetryEvent, { type: 'block' }> | undefined), [blockCache, events]);
  const lastBlockAgeSec = latestBlock ? Math.max(0, Math.floor((now - latestBlock.time * 1000) / 1000)) : null;
  const sinceLabel = lastBlockAgeSec !== null ? formatDuration(lastBlockAgeSec) : '—';
  const blockInterval = latestBlock?.interval ? formatDuration(Math.floor(latestBlock.interval)) : '—';

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
          <span>Regtest telemetry</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.65rem', borderRadius: 999, background: tone.bg, color: tone.fg, border: `1px solid ${tone.bg}` }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: tone.dot, boxShadow: status === 'open' ? '0 0 0 0 rgba(34,197,94,0.3)' : 'none', animation: status === 'open' ? 'telemetry-pulse 1.8s infinite' : 'none' }} />
            {tone.label}
          </span>
        </div>
        <span style={{ fontSize: '0.95rem', color: '#475569' }}>Height: {height ?? '…'}</span>
      </div>
      <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>Endpoint</span>
        <code style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 8 }}>{activeUrl}</code>
        {attemptNote && <span style={{ color: '#c2410c' }}>{attemptNote}</span>}
      </div>
      {status === 'error' && (
        <div style={{ fontSize: '0.9rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecdd3', padding: '0.45rem 0.6rem', borderRadius: 10, display: 'grid', gap: 4 }}>
          <span>Stream error: {errorMsg ?? 'disconnected'} — retrying…</span>
          {suggestFix(activeUrl, errorMsg)?.length ? <span style={{ color: '#9f1239' }}>{suggestFix(activeUrl, errorMsg)}</span> : null}
          <span style={{ color: '#9f1239' }}>If you are in dev, ensure API is running (`pnpm dev:logs`) and check API logs for `/ws/telemetry` errors.</span>
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'minmax(260px, 320px) 1fr', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, border: '1px solid #e2e8f0', background: '#0f172a', color: '#e2e8f0', padding: '1rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 20%, rgba(14,165,233,0.2), transparent 40%), radial-gradient(ellipse at 80% 20%, rgba(34,197,94,0.16), transparent 42%)' }} />
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
            <BlockIcon flashKey={blockFlashKey} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>Last block</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>#{latestBlock?.height ?? '—'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: '#cbd5e1', fontSize: '0.95rem' }}>
                <span>Since: {sinceLabel}</span>
                <span>• Interval: {blockInterval}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label="Txs" value={latestBlock?.txs ?? '—'} />
                <Chip label="Size" value={latestBlock?.size != null ? `${(latestBlock.size / 1024).toFixed(1)} KB` : '—'} />
                <Chip label="Weight" value={latestBlock?.weight != null ? `${latestBlock.weight}` : '—'} />
                <Chip label="Mempool" value={formatMempool(latestBlock)} />
              </div>
              <code style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', wordBreak: 'break-all' }}>
                {latestBlock?.hash ? latestBlock.hash : 'hash unavailable'}
              </code>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.95rem', color: '#475569', display: 'grid', gap: '0.4rem', alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>Node</span>
            <span style={{ color: '#475569' }}>{nodeInfo.uri ?? '…'}</span>
            <span style={{ color: '#475569' }}>• IP: {nodeInfo.ip ?? '…'}</span>
            {latest && <span style={{ color: '#475569' }}>• Last event: {detail(latest)}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {events.map((ev) => (
              <div key={eventKey(ev)} style={{ padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: 999, background: ev.type === 'block' ? '#22c55e' : ev.type === 'tx' ? '#0ea5e9' : '#f59e0b' }} />
                  {label(ev)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#475569' }}>{detail(ev)}</div>
              </div>
            ))}
            {events.length === 0 && <div style={{ color: '#94a3b8' }}>Waiting for events…</div>}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes telemetry-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35);} 70% { box-shadow: 0 0 0 10px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
        @keyframes block-pop { 0% { transform: translateY(4px) scale(0.96); opacity: 0.4; } 70% { transform: translateY(-2px) scale(1.02); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.55rem', borderRadius: 10, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', fontSize: '0.85rem' }}>
      <span style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.75rem', color: '#cbd5e1' }}>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function BlockIcon({ flashKey }: { flashKey: string | null }) {
  return (
    <div style={{ position: 'relative', width: 74, height: 74 }}>
      <div
        key={flashKey ?? 'block'}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
          boxShadow: '0 18px 50px rgba(14,165,233,0.25)',
          position: 'relative',
          overflow: 'hidden',
          animation: flashKey ? 'block-pop 420ms ease-out' : undefined
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.25), rgba(255,255,255,0))' }} />
        <div style={{ position: 'absolute', inset: '16%', borderRadius: 12, border: '2px solid rgba(255,255,255,0.45)' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: -12,
          borderRadius: 999,
          border: '1px solid rgba(14,165,233,0.4)',
          opacity: flashKey ? 1 : 0.25,
          boxShadow: flashKey ? '0 0 0 0 rgba(34,197,94,0.32)' : 'none',
          animation: flashKey ? 'telemetry-pulse 1.6s infinite' : 'none'
        }}
      />
    </div>
  );
}

function label(ev: TelemetryEvent) {
  if (ev.type === 'block') return `New block #${ev.height}`;
  if (ev.type === 'tx') return `Tx ${ev.txid.slice(0, 10)}…`;
  return `LND (${ev.role})`;
}
function detail(ev: TelemetryEvent) {
  const ts = new Date(ev.time * 1000).toLocaleTimeString();
  if (ev.type === 'block') {
    const parts = [`Time ${ts}`];
    if (ev.txs != null) parts.push(`${ev.txs} txs`);
    if (ev.size != null) parts.push(`${(ev.size / 1024).toFixed(1)} KB`);
    if (ev.weight != null) parts.push(`${ev.weight} wu`);
    if (ev.interval != null) parts.push(`+${formatDuration(Math.floor(ev.interval))}`);
    return parts.join(' • ');
  }
  if (ev.type === 'tx') return `Time ${ts}`;
  return `${ev.event} @ ${ts}`;
}

function eventKey(ev: TelemetryEvent) {
  if (ev.type === 'block') return `block-${ev.height}-${ev.hash ?? ''}`;
  if (ev.type === 'tx') return `tx-${ev.txid}`;
  return `lnd-${ev.role}-${ev.event}-${ev.time}`;
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

function formatMempool(block?: Extract<TelemetryEvent, { type: 'block' }>) {
  if (!block) return '—';
  if (block.mempoolTxs == null && block.mempoolBytes == null) return '—';
  const txs = block.mempoolTxs ?? 0;
  const kb = ((block.mempoolBytes ?? 0) / 1024).toFixed(0);
  return `${txs} tx / ${kb} KB`;
}
