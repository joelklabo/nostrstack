import { resolveTelemetryWs } from '@nostrstack/embed';
import { useEffect, useRef,useState } from 'react';

interface TelemetryMessage {
  ts: number;
  level: string;
  message: string;
  data?: unknown;
}

export function TelemetryBar() {
  const [logs, setLogs] = useState<TelemetryMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const telemetryWsUrl = resolveTelemetryWs(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001');
    if (!telemetryWsUrl) {
      setLogs([{ ts: Date.now(), level: 'error', message: 'Telemetry WS URL not resolved.' }]);
      return;
    }

    const ws = new WebSocket(telemetryWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'info', message: 'Telemetry: Connected' }]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TelemetryMessage;
        setLogs(prev => [...prev, msg].slice(-100)); // Keep last 100 messages
      } catch (e) {
        console.error('Failed to parse telemetry message', e);
      }
    };

    ws.onerror = (error) => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'error', message: `Telemetry: Error: ${error}` }]);
    };

    ws.onclose = () => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'warn', message: 'Telemetry: Disconnected' }]);
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const formatMessage = (msg: TelemetryMessage) => {
    const levelColor: Record<string, string> = {
      info: 'var(--terminal-dim)',
      warn: '#ffaa00',
      error: '#f00',
      debug: '#008f11'
    };
    const color = levelColor[msg.level.toLowerCase()] || 'var(--terminal-dim)';
    const data = msg.data ? JSON.stringify(msg.data) : '';

    return (
      <div className="log-entry" style={{ color }}>
        <span style={{ color: 'var(--terminal-text)' }}>[{new Date(msg.ts).toLocaleTimeString()}]</span>{' '}
        <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{msg.level}</span>:{' '}
        {msg.message} {data}
      </div>
    );
  };

  return (
    <div className="telemetry-log">
      <div style={{ padding: '0.5rem', background: 'var(--terminal-dim)', color: '#000', fontWeight: 'bold' }}>
        SYSTEM_TELEMETRY
      </div>
      <div style={{ padding: '0.5rem' }}>
        {logs.map((log, i) => (
          <div key={i} className="log-entry">{formatMessage(log)}</div>
        ))}
      </div>
    </div>
  );
}