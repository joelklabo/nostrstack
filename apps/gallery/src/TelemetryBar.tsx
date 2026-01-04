import {
  type BitcoinStatus,
  type PaymentFailureReason,
  type PaymentMethod,
  type PaymentTelemetryEvent,
  type SearchTelemetryEvent,
  subscribeTelemetry,
  useBitcoinStatus
} from '@nostrstack/blog-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from './ui/Alert';
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

type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

type TelemetryTiming = {
  wsBaseDelayMs: number;
  wsMaxDelayMs: number;
  wsMaxAttempts: number;
  wsJitter: number;
  offlinePollBaseMs: number;
  offlinePollMaxMs: number;
  offlinePollJitter: number;
};

interface LogEntry {
  ts: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';
const DEFAULT_TELEMETRY_TIMING: TelemetryTiming = {
  wsBaseDelayMs: 1000,
  wsMaxDelayMs: 30_000,
  wsMaxAttempts: 8,
  wsJitter: 0.2,
  offlinePollBaseMs: 30_000,
  offlinePollMaxMs: 60_000,
  offlinePollJitter: 0.2
};
const AUTH_CLOSE_CODES = new Set([4001, 4003, 4401, 4403]);

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

function applyJitter(baseMs: number, jitter: number) {
  const spread = baseMs * jitter;
  const offset = (Math.random() * 2 - 1) * spread;
  return Math.max(0, Math.round(baseMs + offset));
}

function resolveTelemetryTiming(): TelemetryTiming {
  if (typeof window === 'undefined') return DEFAULT_TELEMETRY_TIMING;
  if (!import.meta.env.DEV) return DEFAULT_TELEMETRY_TIMING;
  const overrides = (window as Window & { __NOSTRSTACK_TELEMETRY_TIMING__?: Partial<TelemetryTiming> })
    .__NOSTRSTACK_TELEMETRY_TIMING__;
  if (!overrides) return DEFAULT_TELEMETRY_TIMING;
  const readNumber = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    wsBaseDelayMs: readNumber(overrides.wsBaseDelayMs, DEFAULT_TELEMETRY_TIMING.wsBaseDelayMs),
    wsMaxDelayMs: readNumber(overrides.wsMaxDelayMs, DEFAULT_TELEMETRY_TIMING.wsMaxDelayMs),
    wsMaxAttempts: readNumber(overrides.wsMaxAttempts, DEFAULT_TELEMETRY_TIMING.wsMaxAttempts),
    wsJitter: readNumber(overrides.wsJitter, DEFAULT_TELEMETRY_TIMING.wsJitter),
    offlinePollBaseMs: readNumber(overrides.offlinePollBaseMs, DEFAULT_TELEMETRY_TIMING.offlinePollBaseMs),
    offlinePollMaxMs: readNumber(overrides.offlinePollMaxMs, DEFAULT_TELEMETRY_TIMING.offlinePollMaxMs),
    offlinePollJitter: readNumber(overrides.offlinePollJitter, DEFAULT_TELEMETRY_TIMING.offlinePollJitter)
  };
}

function computeBackoffMs(attempt: number, timing: TelemetryTiming) {
  const base = timing.wsBaseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(timing.wsMaxDelayMs, base);
  return applyJitter(capped, timing.wsJitter);
}

export function TelemetryBar() {
  const [logLimit, setLogLimit] = useState(() => {
    if (typeof window === 'undefined') return 50;
    const saved = window.localStorage.getItem('nostrstack.telemetry.logLimit');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [nodeState, setNodeState] = useState<NodeState | null>(null);
  const [devNetworkOverride, setDevNetworkOverride] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [wsAttempt, setWsAttempt] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const { status, error: statusError, isLoading: statusLoading, refresh } = useBitcoinStatus();

  const lastStatusErrorRef = useRef<string | null>(null);
  const pollFailuresRef = useRef(0);
  const statusErrorRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const telemetryTiming = useMemo(resolveTelemetryTiming, []);
  
  const appendLog = useCallback((entry: LogEntry) => {
    setLogs(prev => {
      const next = [...prev, entry];
      return next.slice(-logLimit);
    });
  }, [logLimit]);

  const mergeNodeState = useCallback((next: Partial<NodeState>) => {
    setNodeState(prev => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nostrstack.telemetry.logLimit', String(logLimit));
    }
    setLogs(prev => prev.slice(-logLimit));
  }, [logLimit]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        status?: WsStatus;
        offlineReason?: string | null;
        attempt?: number;
      }>).detail;
      if (!detail) return;
      if (detail.status) setWsStatus(detail.status);
      if ('offlineReason' in detail) setOfflineReason(detail.offlineReason ?? null);
      if (typeof detail.attempt === 'number') setWsAttempt(detail.attempt);
    };
    window.addEventListener('nostrstack:telemetry-ws-state', handler as EventListener);
    return () => window.removeEventListener('nostrstack:telemetry-ws-state', handler as EventListener);
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
    
    const handleManualUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ height: number }>).detail;
      if (detail && detail.height) {
        setNodeState(prev => ({ ...prev, height: detail.height }));
        appendLog({ ts: Date.now(), level: 'info', message: `Manual update: Block ${detail.height}` });
        refresh();
      }
    };
    window.addEventListener('nostrstack:manual-block-update', handleManualUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:dev-network', handleCustom as EventListener);
      window.removeEventListener('nostrstack:manual-block-update', handleManualUpdate as EventListener);
    };
  }, [refresh, appendLog]);

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
    pollFailuresRef.current = pollFailures;
  }, [pollFailures]);

  useEffect(() => {
    if (!status?.telemetry?.time) return;
    setLastUpdateAt(status.telemetry.time * 1000);
  }, [status?.telemetry?.time]);

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
    statusErrorRef.current = statusError;
  }, [statusError]);

  useEffect(() => {
    const telemetryWsUrl = resolveTelemetryWs(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001');
    if (!telemetryWsUrl) {
      appendLog({ ts: Date.now(), level: 'error', message: 'Telemetry WS URL not resolved.' });
      setWsStatus('offline');
      setOfflineReason('Telemetry WS URL not resolved.');
      return;
    }

    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;
    let offlineLogged = false;

    const clearRetry = () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = null;
    };

    const clearPoll = () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      pollTimeout = null;
    };

    const schedulePoll = () => {
      const base = pollFailuresRef.current >= 3
        ? telemetryTiming.offlinePollMaxMs
        : telemetryTiming.offlinePollBaseMs;
      const delay = applyJitter(base, telemetryTiming.offlinePollJitter);
      pollTimeout = setTimeout(() => {
        if (cancelled) return;
        if (statusErrorRef.current) {
          setPollFailures(prev => Math.min(prev + 1, 3));
        } else {
          setPollFailures(0);
        }
        refresh();
        schedulePoll();
      }, delay);
    };

    const markOffline = (reason: string) => {
      clearRetry();
      setWsStatus('offline');
      setOfflineReason(reason);
      setWsAttempt(Math.min(attempt, telemetryTiming.wsMaxAttempts));
      if (!offlineLogged) {
        appendLog({ ts: Date.now(), level: 'warn', message: `Telemetry offline: ${reason}` });
        offlineLogged = true;
      }
      if (!pollTimeout) schedulePoll();
    };

    const connect = () => {
      if (cancelled) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        markOffline('Browser offline');
        return;
      }

      setWsStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      setWsAttempt(attempt);
      ws = new WebSocket(telemetryWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          safeClose(ws);
          return;
        }
        attempt = 0;
        offlineLogged = false;
        setWsAttempt(0);
        setWsStatus('connected');
        setOfflineReason(null);
        clearRetry();
        clearPoll();
        setPollFailures(0);
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
            setLastUpdateAt(msg.time * 1000);
            appendLog({
              ts: msg.time * 1000,
              level: 'info',
              message: `New Block: ${msg.height} (${msg.txs} txs)`
            });
          } else if (msg.type === 'error') {
            appendLog({
              ts: msg.time * 1000,
              level: 'error',
              message: msg.message
            });
          }
        } catch (e) {
          console.error('Failed to parse telemetry message', e);
        }
      };

      ws.onerror = () => {
        appendLog({ ts: Date.now(), level: 'error', message: 'Telemetry WebSocket Error' });
      };

      ws.onclose = (event) => {
        if (cancelled) return;
        wsRef.current = null;
        if (AUTH_CLOSE_CODES.has(event.code)) {
          markOffline('Authentication required');
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          markOffline('Browser offline');
          return;
        }
        if (attempt >= telemetryTiming.wsMaxAttempts) {
          markOffline('Max retries reached');
          return;
        }
        const delay = computeBackoffMs(attempt, telemetryTiming);
        const nextAttempt = attempt + 1;
        attempt = nextAttempt;
        setWsAttempt(nextAttempt);
        setWsStatus('reconnecting');
        appendLog({ ts: Date.now(), level: 'warn', message: `Disconnected from telemetry. Reconnecting in ${Math.round(delay / 1000)}s.` });
        retryTimeout = setTimeout(connect, delay);
      };
    };

    const handleOnline = () => {
      if (cancelled) return;
      offlineLogged = false;
      clearPoll();
      attempt = 0;
      connect();
    };

    const handleOffline = () => {
      if (cancelled) return;
      safeClose(wsRef.current);
      markOffline('Browser offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    connect();

    return () => {
      cancelled = true;
      clearRetry();
      clearPoll();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      safeClose(wsRef.current);
      wsRef.current = null;
    };
  }, [appendLog, refresh, telemetryTiming]);

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
  const reconnectAttempt = Math.min(Math.max(wsAttempt, 0), telemetryTiming.wsMaxAttempts);
  const wsStatusLabel = wsStatus === 'connected'
    ? 'Connected'
    : wsStatus === 'connecting'
      ? 'Connecting'
      : wsStatus === 'reconnecting'
        ? `Reconnecting (${Math.max(1, reconnectAttempt)}/${telemetryTiming.wsMaxAttempts})`
        : 'Offline';
  const lastUpdateLabel = lastUpdateAt
    ? `Updated ${new Date(lastUpdateAt).toLocaleTimeString([], { hour12: false })}`
    : 'No updates yet';
  const showStale = wsStatus === 'offline' && pollFailures >= 3;

  return (
    <div className="telemetry-sidebar">
      {statusError && (
        <Alert tone="danger" title="Bitcoin status unavailable">
          {statusError}
        </Alert>
      )}
      {!nodeInfoWithConfig && statusLoading && (
        <Alert tone="info" title="Loading network status">
          Fetching Bitcoin node telemetry…
        </Alert>
      )}
      {isMainnet && (
        <Alert tone="danger" title="Mainnet active">
          Real sats and payments are live.
        </Alert>
      )}
      <div className="telemetry-status-row">
        <span className="telemetry-status" data-status={wsStatus}>
          <span className="telemetry-status-dot" />
          {wsStatusLabel}
        </span>
        <span className="telemetry-status-time">
          {lastUpdateLabel}
          {showStale && <span className="telemetry-status-stale">Stale</span>}
        </span>
      </div>
      {wsStatus === 'offline' && offlineReason && (
        <div className="telemetry-status-note">
          {offlineReason}
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
      
      <div className="telemetry-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Activity Log
        <select 
          className="nostrstack-select" 
          style={{ width: 'auto', fontSize: '0.7rem', padding: '2px 1.5rem 2px 6px', height: 'auto' }}
          value={logLimit}
          onChange={(e) => setLogLimit(parseInt(e.target.value, 10))}
          title="Max log entries"
        >
          <option value="20">20 lines</option>
          <option value="50">50 lines</option>
          <option value="100">100 lines</option>
          <option value="500">500 lines</option>
        </select>
      </div>
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
