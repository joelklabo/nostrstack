import {
  type BitcoinStatus,
  type PaymentFailureReason,
  type PaymentMethod,
  type PaymentTelemetryEvent,
  type SearchTelemetryEvent,
  subscribeTelemetry,
  useBitcoinStatus
} from '@nostrstack/blog-kit';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

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
      headers?: number;
      blocks?: number;
      verificationProgress?: number;
      initialBlockDownload?: boolean;
    }
  | { type: 'tx'; txid: string; time: number }
  | { type: 'lnd'; role: 'merchant' | 'payer'; event: string; time: number }
  | { type: 'error'; message: string; time: number };

type TelemetrySnapshot = Partial<Omit<BitcoinStatus['telemetry'], 'version'>> & {
  version?: string | number;
};

type NodeState = TelemetrySnapshot & {
  configuredNetwork?: string;
  source?: string;
  telemetryError?: string;
  lightning?: BitcoinStatus['lightning'];
};

interface LogEntry {
  ts: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';

function formatTelemetryMethod(method?: PaymentMethod): string {
  if (!method) return '';
  const labels: Record<PaymentMethod, string> = {
    nwc: 'NWC',
    webln: 'WebLN',
    manual: 'Manual',
    regtest: 'Regtest'
  };
  return labels[method];
}

function formatTelemetryReason(reason?: PaymentFailureReason): string {
  if (!reason) return '';
  switch (reason) {
    case 'lnurl':
      return 'LNURL';
    case 'validation':
      return 'Validation';
    case 'unknown':
      return 'Unknown';
    default:
      return formatTelemetryMethod(reason as PaymentMethod) || String(reason);
  }
}

function formatPaymentTelemetry(event: PaymentTelemetryEvent): LogEntry {
  const flowLabel = event.flow === 'send-sats' ? 'Send sats' : 'Zap';
  const amountLabel = typeof event.amountSats === 'number' ? ` (${event.amountSats} sats)` : '';
  const methodLabel = formatTelemetryMethod(event.method);
  const reasonLabel = formatTelemetryReason(event.reason);
  const methodSuffix = methodLabel ? ` via ${methodLabel}` : '';
  const reasonSuffix = reasonLabel && reasonLabel !== methodLabel ? ` (${reasonLabel})` : '';
  const ts = event.timestamp;

  switch (event.stage) {
    case 'invoice_requested':
      return { ts, level: 'info', message: `${flowLabel}: invoice requested${amountLabel}` };
    case 'invoice_ready':
      return { ts, level: 'info', message: `${flowLabel}: invoice ready${amountLabel}` };
    case 'payment_sent':
      return { ts, level: 'info', message: `${flowLabel}: payment sent${amountLabel}${methodSuffix}` };
    case 'payment_failed':
      return { ts, level: 'error', message: `${flowLabel}: payment failed${amountLabel}${methodSuffix}${reasonSuffix}` };
    default:
      return { ts, level: 'info', message: `${flowLabel}: event` };
  }
}

function formatSearchTelemetry(event: SearchTelemetryEvent): LogEntry {
  const ts = event.timestamp;
  const queryLabel = event.query;
  const sourceLabel = event.source ? ` (${event.source})` : '';
  const reasonLabel = event.reason ? ` (${event.reason})` : '';

  switch (event.stage) {
    case 'start':
      return { ts, level: 'info', message: `Search: started (${queryLabel})` };
    case 'success':
      return { ts, level: 'info', message: `Search: resolved (${queryLabel})${sourceLabel}` };
    case 'failure':
      return { ts, level: 'error', message: `Search: failed (${queryLabel})${reasonLabel}` };
    default:
      return { ts, level: 'info', message: `Search: event (${queryLabel})` };
  }
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
  const [nodeState, setNodeState] = useState<NodeState | null>(null);
  const [devNetworkOverride, setDevNetworkOverride] = useState<string | null>(null);
  const { status, error: statusError, isLoading: statusLoading } = useBitcoinStatus();

  const lastStatusErrorRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const appendLog = useCallback((entry: LogEntry, limit = 50) => {
    setLogs(prev => {
      const next = [...prev, entry];
      return next.slice(-limit);
    });
  }, []);
  const mergeNodeState = useCallback((next: Partial<NodeState>) => {
    setNodeState(prev => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const readOverride = () => {
      const raw = window.localStorage.getItem(DEV_NETWORK_KEY);
      const value = raw ? raw.trim() : '';
      setDevNetworkOverride(value || null);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEV_NETWORK_KEY) readOverride();
    };
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      setDevNetworkOverride(detail && detail.trim() ? detail.trim() : null);
    };
    readOverride();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nostrstack:dev-network', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:dev-network', handleCustom as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!status?.telemetry) return;
    mergeNodeState({
      ...status.telemetry,
      network: status.telemetry.network ?? status.network,
      configuredNetwork: status.configuredNetwork,
      source: status.source,
      telemetryError: status.telemetryError,
      lightning: status.lightning,
      version: status.telemetry.subversion ?? status.telemetry.version
    });
  }, [mergeNodeState, status]);

  useEffect(() => {
    if (!statusError) {
      lastStatusErrorRef.current = null;
      return;
    }
    if (lastStatusErrorRef.current === statusError) return;
    lastStatusErrorRef.current = statusError;
    appendLog({ ts: Date.now(), level: 'warn', message: statusError });
  }, [appendLog, statusError]);

  useEffect(() => {
    const telemetryWsUrl = resolveTelemetryWs(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001');
    if (!telemetryWsUrl) {
      appendLog({ ts: Date.now(), level: 'error', message: 'Telemetry WS URL not resolved.' });
      return;
    }
    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      if (cancelled) return;
      const ws = new WebSocket(telemetryWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        appendLog({ ts: Date.now(), level: 'info', message: 'Connected to Telemetry Service' });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as TelemetryEvent;
          
          if (msg.type === 'block') {
            setNodeState(prev => ({
              ...prev,
              network: msg.network ?? prev?.network,
              height: msg.height ?? prev?.height,
              hash: msg.hash ?? prev?.hash,
              time: msg.time ?? prev?.time,
              interval: msg.interval ?? prev?.interval,
              mempoolTxs: msg.mempoolTxs ?? prev?.mempoolTxs,
              mempoolBytes: msg.mempoolBytes ?? prev?.mempoolBytes,
              version: msg.subversion || msg.version || prev?.version,
              connections: msg.connections ?? prev?.connections,
              headers: msg.headers ?? prev?.headers,
              blocks: msg.blocks ?? prev?.blocks,
              verificationProgress: msg.verificationProgress ?? prev?.verificationProgress,
              initialBlockDownload: msg.initialBlockDownload ?? prev?.initialBlockDownload
            }));
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
  }, [appendLog]);

  useEffect(() => {
    return subscribeTelemetry((event) => {
      if (event.type === 'payment') {
        appendLog(formatPaymentTelemetry(event));
        return;
      }
      if (event.type === 'search') {
        appendLog(formatSearchTelemetry(event));
      }
    });
  }, [appendLog]);

  const nodeInfo = status || nodeState
    ? {
        ...status?.telemetry,
        ...nodeState,
        network: nodeState?.network ?? status?.network ?? status?.telemetry?.network,
        configuredNetwork: status?.configuredNetwork ?? nodeState?.configuredNetwork,
        source: status?.source ?? nodeState?.source,
        telemetryError: status?.telemetryError ?? nodeState?.telemetryError,
        lightning: status?.lightning ?? nodeState?.lightning
      }
    : null;
  const defaultNetwork = String(import.meta.env.VITE_NETWORK ?? 'regtest').trim();
  const configuredNetwork = (devNetworkOverride ?? nodeInfo?.configuredNetwork ?? nodeInfo?.network ?? defaultNetwork).trim();
  const nodeInfoWithConfig = nodeInfo ? { ...nodeInfo, configuredNetwork } : null;
  const isMainnet = configuredNetwork.toLowerCase() === 'mainnet';

  return (
    <div className="telemetry-sidebar">
      {statusError && (
        <div
          className="nostrstack-callout"
          style={{
            marginBottom: '1rem',
            '--nostrstack-callout-tone': 'var(--nostrstack-color-danger)'
          } as CSSProperties}
        >
          <div className="nostrstack-callout__title">Bitcoin status unavailable</div>
          <div className="nostrstack-callout__content">{statusError}</div>
        </div>
      )}
      {!nodeInfoWithConfig && statusLoading && (
        <div
          className="nostrstack-callout"
          style={{
            marginBottom: '1rem',
            '--nostrstack-callout-tone': 'var(--nostrstack-color-accent)'
          } as CSSProperties}
        >
          <div className="nostrstack-callout__title">Loading network status</div>
          <div className="nostrstack-callout__content">Fetching Bitcoin node telemetry…</div>
        </div>
      )}
      {isMainnet && (
        <div
          className="nostrstack-callout"
          style={{
            marginBottom: '1rem',
            '--nostrstack-callout-tone': 'var(--nostrstack-color-danger)'
          } as CSSProperties}
        >
          <div className="nostrstack-callout__title">Mainnet active</div>
          <div className="nostrstack-callout__content">Real sats and payments are live.</div>
        </div>
      )}
      {nodeInfoWithConfig && (
        <div style={{ marginBottom: '1.5rem' }}>
          <BitcoinNodeCard info={nodeInfoWithConfig} />
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
