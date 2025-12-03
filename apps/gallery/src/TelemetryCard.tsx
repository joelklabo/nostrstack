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

export function TelemetryCard({ wsUrl }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [nodeInfo, setNodeInfo] = useState<{ uri?: string; ip?: string }>({});
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [now, setNow] = useState(Date.now());
  const [blockFlashKey, setBlockFlashKey] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
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
      ws.onopen = () => setStatus('open');
      ws.onerror = () => setStatus('error');
      ws.onclose = () => {
        setStatus('error');
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
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
  const latestBlock = useMemo(() => events.find(isBlockEvent), [events]);
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
                <Chip label="Size" value={latestBlock?.size ? `${(latestBlock.size / 1024).toFixed(1)} KB` : '—'} />
                <Chip label="Weight" value={latestBlock?.weight ? `${latestBlock.weight}` : '—'} />
                <Chip
                  label="Mempool"
                  value={
                    latestBlock?.mempoolTxs != null
                      ? `${latestBlock.mempoolTxs} tx / ${((latestBlock.mempoolBytes ?? 0) / 1024).toFixed(0)} KB`
                      : '—'
                  }
                />
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
    if (ev.size) parts.push(`${(ev.size / 1024).toFixed(1)} KB`);
    if (ev.weight) parts.push(`${ev.weight} wu`);
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
