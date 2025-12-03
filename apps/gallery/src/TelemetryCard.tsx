import { useEffect, useMemo, useRef, useState } from 'react';

type TelemetryEvent =
  | { type: 'block'; height: number; hash?: string; time: number }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number };

type Props = { wsUrl: string };

export function TelemetryCard({ wsUrl }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [nodeInfo, setNodeInfo] = useState<{ uri?: string; ip?: string }>({});
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as TelemetryEvent;
        if (ev.type === 'block' && typeof ev.height === 'number') setHeight(ev.height);
        setEvents((prev) => [ev, ...prev].slice(0, 10));
      } catch (err) {
        console.warn('telemetry parse', err);
      }
    };
    ws.onopen = () => setStatus('open');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      setStatus('error');
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => setStatus('connecting'), 3000);
    };
    return () => ws.close();
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
      <div style={{ fontSize: '0.95rem', color: '#475569', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span>Node: {nodeInfo.uri ?? '…'}</span>
        <span>• IP: {nodeInfo.ip ?? '…'}</span>
        {latest && <span>• Last event: {detail(latest)}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {events.map((ev, idx) => (
          <div key={`${ev.type}-${idx}`} style={{ padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
            <div style={{ fontWeight: 700 }}>{label(ev)}</div>
            <div style={{ fontSize: '0.9rem', color: '#475569' }}>{detail(ev)}</div>
          </div>
        ))}
        {events.length === 0 && <div style={{ color: '#94a3b8' }}>Waiting for events…</div>}
      </div>
      <style>{`
        @keyframes telemetry-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35);} 70% { box-shadow: 0 0 0 10px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
      `}</style>
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
  if (ev.type === 'block') return `Time ${ts}`;
  if (ev.type === 'tx') return `Time ${ts}`;
  return `${ev.event} @ ${ts}`;
}
