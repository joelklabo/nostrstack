import { resolveTelemetryWs } from '@nostrstack/embed';
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

    const ws = new WebSocket(telemetryWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'info', message: 'Telemetry: Connected' }]);
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
          setLogs(prev => [...prev, { 
            ts: msg.time * 1000, 
            level: 'info', 
            message: `New Block: ${msg.height} (${msg.txs} txs)` 
          }].slice(-50));
        } else if (msg.type === 'error') {
          setLogs(prev => [...prev, { 
            ts: msg.time * 1000, 
            level: 'error', 
            message: msg.message 
          }].slice(-50));
        } else {
           // Handle other types if needed
        }
      } catch (e) {
        console.error('Failed to parse telemetry message', e);
      }
    };

    ws.onerror = () => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'error', message: 'Telemetry WebSocket Error' }]);
    };

    ws.onclose = () => {
      setLogs(prev => [...prev, { ts: Date.now(), level: 'warn', message: 'Telemetry: Disconnected' }]);
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="telemetry-log">
      <div style={{ padding: '0.5rem', background: 'var(--terminal-dim)', color: '#000', fontWeight: 'bold' }}>
        SYSTEM_TELEMETRY
      </div>
      
      {nodeState && (
        <div style={{ padding: '0.5rem' }}>
          <BitcoinNodeCard info={nodeState} />
        </div>
      )}

      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--terminal-border)', marginBottom: '0.5rem', fontSize: '0.7rem' }}>
        <div>MONITORED RELAYS:</div>
        <div style={{ color: '#0ff' }}>wss://relay.damus.io [OK]</div>
        <div style={{ color: '#0ff' }}>wss://relay.snort.social [OK]</div>
        <div style={{ color: '#0ff' }}>wss://nos.lol [OK]</div>
      </div>
      
      <div style={{ padding: '0.5rem', overflowY: 'auto', flex: 1 }}>
        {logs.map((log, i) => (
          <div key={i} className="log-entry" style={{ 
            color: log.level === 'error' ? '#f00' : log.level === 'warn' ? '#ffaa00' : 'var(--terminal-dim)',
            marginBottom: '4px'
          }}>
            <span style={{ color: 'var(--terminal-text)' }}>[{new Date(log.ts).toLocaleTimeString()}]</span>{' '}
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}