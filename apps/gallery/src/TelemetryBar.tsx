import { useEffect, useRef, useState } from 'react';

import { BitcoinNodeCard } from './ui/BitcoinNodeCard';

type TelemetryEvent =
  | {
      type: 'block';
      height: number;
      hash: string;
      time: number;
      txs?: number;
      size?: number;
      weight?: number;
      interval?: number;
      mempoolTxs?: number;
      mempoolBytes?: number;
      network?: string;
      version?: number;
      subversion?: string;
      connections?: number;
    }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number }
  | { type: 'error'; message: string; time: number };

interface LogEntry {
  ts: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}

function resolveTelemetryWs(baseURL?: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = preferSecureBase(raw.replace(/\/$/, ''));
  if (base === '/api') {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  if (!base) {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  return `${window.location.origin.replace(/^http/i, 'ws')}${base}/ws/telemetry`;
}

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
  return base.replace(/^http:/i, 'https:');
}

function safeClose(socket: WebSocket | null) {
  if (!socket) return;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try {
      socket.close();
    } catch {
      // Ignore close errors from already-closed sockets.
    }
  }
}

export function TelemetryBar() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [nodeState, setNodeState] = useState<{
    network?: string;
    height?: number;
    version?: string;
    connections?: number;
    hash?: string;
  } | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const telemetryWsUrl = resolveTelemetryWs(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001');
    if (!telemetryWsUrl) {
      setLogs([{ ts: Date.now(), level: 'error', message: 'Telemetry WS URL not resolved.' }]);
      return;
    }
    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      if (cancelled) return;
      const ws = new WebSocket(telemetryWsUrl);
      wsRef.current = ws;
      const appendLog = (entry: LogEntry, limit?: number) => {
        setLogs(prev => {
          const next = [...prev, entry];
          return typeof limit === 'number' ? next.slice(-limit) : next;
        });
      };

      ws.onopen = () => {
        appendLog({ ts: Date.now(), level: 'info', message: 'Connected to Telemetry Service' });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as TelemetryEvent;
          
          if (msg.type === 'block') {
            setNodeState({
              network: msg.network,
              height: msg.height,
              version: msg.subversion || (msg.version ? String(msg.version) : undefined),
              connections: msg.connections,
              hash: msg.hash
            });
            appendLog(
              {
                ts: msg.time * 1000,
                level: 'info',
                message: `New Block: ${msg.height} (${msg.txs} txs)`
              },
              50
            );
          } else if (msg.type === 'error') {
            appendLog(
              {
                ts: msg.time * 1000,
                level: 'error',
                message: msg.message
              },
              50
            );
          }
        } catch (e) {
          console.error('Failed to parse telemetry message', e);
        }
      };

      ws.onerror = () => {
        appendLog({ ts: Date.now(), level: 'error', message: 'Telemetry WebSocket Error' });
      };

      ws.onclose = () => {
        appendLog({ ts: Date.now(), level: 'warn', message: 'Disconnected from Telemetry' });
      };
    }, 0);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
      safeClose(wsRef.current);
      wsRef.current = null;
    };
  }, []);

  return (
    <div className="telemetry-sidebar">
      {nodeState && (
        <div style={{ marginBottom: '1.5rem' }}>
          <BitcoinNodeCard info={nodeState} />
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: 'var(--color-fg-muted)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em', 
          marginBottom: '0.5rem' 
        }}>
          Monitored Relays
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[
            'wss://relay.damus.io',
            'wss://relay.snort.social',
            'wss://nos.lol'
          ].map(relay => (
            <div key={relay} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              fontSize: '0.8rem',
              color: 'var(--color-fg-default)' 
            }}>
              <div style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                background: 'var(--color-success-fg)', 
                marginRight: '8px' 
              }} />
              {relay.replace('wss://', '')}
            </div>
          ))}
        </div>
      </div>
      
      <div className="telemetry-header">Activity Log</div>
      <div className="telemetry-log">
        {logs.length === 0 && (
          <div style={{ padding: '0.5rem', fontStyle: 'italic', color: 'var(--color-fg-muted)' }}>
            No recent activity...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ 
            color: log.level === 'error' ? 'var(--color-danger-fg)' : log.level === 'warn' ? 'var(--color-attention-fg)' : 'var(--color-fg-muted)',
            marginBottom: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: '1.4'
          }}>
            <span style={{ color: 'var(--color-fg-subtle)', marginRight: '6px' }}>
              {new Date(log.ts).toLocaleTimeString([], { hour12: false })}
            </span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
