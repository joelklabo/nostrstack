import { useEffect, useState } from 'react';

type TelemetryEvent =
  | { type: 'block'; height: number; hash?: string; time: number }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number };

type Props = { wsUrl: string };

export function TelemetryCard({ wsUrl }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [nodeInfo, setNodeInfo] = useState<{ uri?: string; ip?: string }>({});

  useEffect(() => {
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
    return () => ws.close();
  }, [wsUrl]);

  useEffect(() => {
    // TODO: fetch static node info from API once exposed
    setNodeInfo({ uri: 'lnd-merchant@localhost:9735', ip: '127.0.0.1' });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Regtest telemetry</strong>
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Height: {height ?? '…'}</span>
      </div>
      <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.5rem' }}>
        Node: {nodeInfo.uri ?? '…'} • IP: {nodeInfo.ip ?? '…'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {events.map((ev, idx) => (
          <div key={idx} style={{ padding: '0.45rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
            <div style={{ fontWeight: 700 }}>{label(ev)}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>{detail(ev)}</div>
          </div>
        ))}
        {events.length === 0 && <div style={{ color: '#94a3b8' }}>Waiting for events…</div>}
      </div>
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
