// Premium telemetry styles - glowing Bitcoin data visualization
import './ui/telemetry-premium.css';

import {
  type BitcoinStatus,
  type PaymentFailureReason,
  type PaymentMethod,
  type PaymentTelemetryEvent,
  type SearchTelemetryEvent,
  subscribeTelemetry,
  useBitcoinStatus
} from '@nostrstack/react';
import { Alert, Skeleton } from '@nostrstack/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRelays } from './hooks/useRelays';
import { type ActivityEvent, type ActivityEventType, ActivityLog } from './ui/ActivityLog';
import { BitcoinNodeCard } from './ui/BitcoinNodeCard';
import { type BlockData, BlockNotification } from './ui/BlockNotification';
import { type ConnectionState, ConnectionStatus, type NetworkType } from './ui/ConnectionStatus';
import { LiveStatsTicker, type NetworkStats } from './ui/LiveStatsTicker';

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
  statusDwellMs: number;
};

interface LogEntry {
  ts: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}

const DEV_NETWORK_KEY = 'nostrstack.dev.network';
const DEFAULT_TELEMETRY_TIMING: TelemetryTiming = {
  wsBaseDelayMs: 2000,
  wsMaxDelayMs: 60_000,
  wsMaxAttempts: 5,
  wsJitter: 0.3,
  offlinePollBaseMs: 60_000,
  offlinePollMaxMs: 120_000,
  offlinePollJitter: 0.3,
  statusDwellMs: 400
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
      return {
        ts,
        level: 'info',
        message: `${flowLabel}: payment sent${amountLabel}${methodSuffix}`
      };
    case 'payment_failed':
      return {
        ts,
        level: 'error',
        message: `${flowLabel}: payment failed${amountLabel}${methodSuffix}${reasonSuffix}`
      };
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
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener(
      'open',
      () => {
        try {
          socket.close();
        } catch {
          // Ignore close errors from already-closed sockets.
        }
      },
      { once: true }
    );
    return;
  }
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
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
  const overrides = (
    window as Window & { __NOSTRSTACK_TELEMETRY_TIMING__?: Partial<TelemetryTiming> }
  ).__NOSTRSTACK_TELEMETRY_TIMING__;
  if (!overrides) return DEFAULT_TELEMETRY_TIMING;
  const readNumber = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    wsBaseDelayMs: readNumber(overrides.wsBaseDelayMs, DEFAULT_TELEMETRY_TIMING.wsBaseDelayMs),
    wsMaxDelayMs: readNumber(overrides.wsMaxDelayMs, DEFAULT_TELEMETRY_TIMING.wsMaxDelayMs),
    wsMaxAttempts: readNumber(overrides.wsMaxAttempts, DEFAULT_TELEMETRY_TIMING.wsMaxAttempts),
    wsJitter: readNumber(overrides.wsJitter, DEFAULT_TELEMETRY_TIMING.wsJitter),
    offlinePollBaseMs: readNumber(
      overrides.offlinePollBaseMs,
      DEFAULT_TELEMETRY_TIMING.offlinePollBaseMs
    ),
    offlinePollMaxMs: readNumber(
      overrides.offlinePollMaxMs,
      DEFAULT_TELEMETRY_TIMING.offlinePollMaxMs
    ),
    offlinePollJitter: readNumber(
      overrides.offlinePollJitter,
      DEFAULT_TELEMETRY_TIMING.offlinePollJitter
    ),
    statusDwellMs: readNumber(overrides.statusDwellMs, DEFAULT_TELEMETRY_TIMING.statusDwellMs)
  };
}

function computeBackoffMs(attempt: number, timing: TelemetryTiming) {
  const base = timing.wsBaseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(timing.wsMaxDelayMs, base);
  return applyJitter(capped, timing.wsJitter);
}

/** Convert log entry to ActivityEvent format */
function logToActivityEvent(log: LogEntry, index: number): ActivityEvent {
  let type: ActivityEventType = 'info';
  const msgLower = log.message.toLowerCase();

  if (msgLower.includes('block')) {
    type = 'block';
  } else if (
    msgLower.includes('zap') ||
    msgLower.includes('payment sent') ||
    msgLower.includes('send sats')
  ) {
    type = 'payment_sent';
  } else if (msgLower.includes('received') || msgLower.includes('tip')) {
    type = 'payment_received';
  } else if (msgLower.includes('connect') && !msgLower.includes('disconnect')) {
    type = 'connection';
  } else if (msgLower.includes('disconnect') || msgLower.includes('offline')) {
    type = 'disconnection';
  } else if (log.level === 'error') {
    type = 'error';
  } else if (log.level === 'warn') {
    type = 'warning';
  }

  return {
    id: `log-${log.ts}-${index}`,
    type,
    timestamp: log.ts,
    title: log.message,
    isNew: Date.now() - log.ts < 5000
  };
}

const LOG_LIMIT = 100;
// CLS FIX: Batch log updates to reduce layout recalculations
const LOG_BATCH_INTERVAL_MS = 100;

export function TelemetryBar() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [nodeState, setNodeState] = useState<NodeState | null>(null);
  const [devNetworkOverride, setDevNetworkOverride] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [displayStatus, setDisplayStatus] = useState<WsStatus>('connecting');
  const [wsAttempt, setWsAttempt] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [latestBlock, setLatestBlock] = useState<BlockData | null>(null);
  const [showBlockNotification, setShowBlockNotification] = useState(false);
  const { status, error: statusError, isLoading: statusLoading, refresh } = useBitcoinStatus();
  const { relays: activeRelays, isLoading: relaysLoading } = useRelays();

  const lastStatusErrorRef = useRef<string | null>(null);
  const pollFailuresRef = useRef(0);
  const statusErrorRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusDwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryTiming = useMemo(resolveTelemetryTiming, []);

  // CLS FIX: Batch log entries to reduce DOM updates and layout shifts
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return;
    const entries = pendingLogsRef.current;
    pendingLogsRef.current = [];
    setLogs((prev) => {
      const next = [...prev, ...entries];
      return next.slice(-LOG_LIMIT);
    });
  }, []);

  const appendLog = useCallback(
    (entry: LogEntry) => {
      pendingLogsRef.current.push(entry);
      // Batch updates to reduce layout recalculations
      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(() => {
          batchTimeoutRef.current = null;
          flushLogs();
        }, LOG_BATCH_INTERVAL_MS);
      }
    },
    [flushLogs]
  );

  // Cleanup batch timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        flushLogs();
      }
    };
  }, [flushLogs]);

  const mergeNodeState = useCallback((next: Partial<NodeState>) => {
    setNodeState((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          status?: WsStatus;
          offlineReason?: string | null;
          attempt?: number;
        }>
      ).detail;
      if (!detail) return;
      if (detail.status) setWsStatus(detail.status);
      if ('offlineReason' in detail) setOfflineReason(detail.offlineReason ?? null);
      if (typeof detail.attempt === 'number') setWsAttempt(detail.attempt);
    };
    window.addEventListener('nostrstack:telemetry-ws-state', handler as EventListener);
    return () =>
      window.removeEventListener('nostrstack:telemetry-ws-state', handler as EventListener);
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
        setNodeState((prev) => ({ ...prev, height: detail.height }));
        appendLog({
          ts: Date.now(),
          level: 'info',
          message: `Manual update: Block ${detail.height}`
        });
        refresh();
      }
    };
    window.addEventListener('nostrstack:manual-block-update', handleManualUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:dev-network', handleCustom as EventListener);
      window.removeEventListener(
        'nostrstack:manual-block-update',
        handleManualUpdate as EventListener
      );
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
    const dwellMs = telemetryTiming.statusDwellMs;
    if (wsStatus === 'connected' || wsStatus === 'connecting') {
      if (statusDwellRef.current) {
        clearTimeout(statusDwellRef.current);
        statusDwellRef.current = null;
      }
      setDisplayStatus(wsStatus);
      return;
    }
    if (displayStatus === wsStatus) return;
    if (statusDwellRef.current) {
      clearTimeout(statusDwellRef.current);
    }
    statusDwellRef.current = setTimeout(() => {
      statusDwellRef.current = null;
      setDisplayStatus(wsStatus);
    }, dwellMs);
    return () => {
      if (statusDwellRef.current) {
        clearTimeout(statusDwellRef.current);
        statusDwellRef.current = null;
      }
    };
  }, [displayStatus, telemetryTiming.statusDwellMs, wsStatus]);

  useEffect(() => {
    const telemetryWsUrl = resolveTelemetryWs(
      import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
    );
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
    let disconnectLogged = false;

    const clearRetry = () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = null;
    };

    const clearPoll = () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      pollTimeout = null;
    };

    const schedulePoll = () => {
      const base =
        pollFailuresRef.current >= 3
          ? telemetryTiming.offlinePollMaxMs
          : telemetryTiming.offlinePollBaseMs;
      const delay = applyJitter(base, telemetryTiming.offlinePollJitter);
      pollTimeout = setTimeout(() => {
        if (cancelled) return;
        if (statusErrorRef.current) {
          setPollFailures((prev) => Math.min(prev + 1, 3));
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
        disconnectLogged = false;
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
            setNodeState((prev) => ({
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
            // Update latest block for notification
            setLatestBlock({
              height: msg.height,
              time: msg.time,
              txCount: msg.txs,
              size: msg.size,
              hash: msg.hash
            });
            setShowBlockNotification(true);
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
        // Only log disconnect once to avoid flooding activity log
        if (!disconnectLogged) {
          appendLog({
            ts: Date.now(),
            level: 'warn',
            message: 'Disconnected from telemetry. Reconnecting...'
          });
          disconnectLogged = true;
        }
        retryTimeout = setTimeout(connect, delay);
      };
    };

    const handleOnline = () => {
      if (cancelled) return;
      offlineLogged = false;
      disconnectLogged = false;
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

  const nodeInfo =
    status || nodeState
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
  const configuredNetwork = (
    devNetworkOverride ??
    nodeInfo?.configuredNetwork ??
    nodeInfo?.network ??
    defaultNetwork
  ).trim();
  const nodeInfoWithConfig = nodeInfo ? { ...nodeInfo, configuredNetwork } : null;
  const isMainnet = configuredNetwork.toLowerCase() === 'mainnet';
  const reconnectAttempt = Math.min(Math.max(wsAttempt, 0), telemetryTiming.wsMaxAttempts);

  // Map wsStatus to ConnectionState
  const connectionState: ConnectionState =
    displayStatus === 'connected'
      ? 'connected'
      : displayStatus === 'connecting'
        ? 'connecting'
        : displayStatus === 'reconnecting'
          ? 'reconnecting'
          : 'offline';

  // Map network to NetworkType
  const networkType: NetworkType = [
    'mainnet',
    'testnet',
    'mutinynet',
    'signet',
    'regtest'
  ].includes(configuredNetwork.toLowerCase())
    ? (configuredNetwork.toLowerCase() as NetworkType)
    : 'unknown';

  // Build network stats for LiveStatsTicker
  const networkStats: NetworkStats | null = nodeInfoWithConfig
    ? {
        blockHeight: nodeInfoWithConfig.height ?? 0,
        lastBlockTime: nodeInfoWithConfig.time
      }
    : null;

  // Convert logs to ActivityEvents
  const activityEvents = useMemo(
    () => logs.map((log, index) => logToActivityEvent(log, index)),
    [logs]
  );

  const handleRetry = useCallback(() => {
    refresh();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('online'));
    }
  }, [refresh]);

  return (
    <div className="telemetry-sidebar">
      {/* Block Notification - appears when new block is found */}
      {showBlockNotification && latestBlock && (
        <BlockNotification
          block={latestBlock}
          onDismiss={() => setShowBlockNotification(false)}
          autoDismiss
          autoDismissDelay={8000}
          className="telemetry-block-notification"
        />
      )}

      {/* Alerts */}
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

      {/* Connection Status - new enhanced component */}
      <ConnectionStatus
        state={connectionState}
        network={networkType}
        lastSyncAt={lastUpdateAt}
        reconnectAttempt={reconnectAttempt}
        maxReconnectAttempts={telemetryTiming.wsMaxAttempts}
        errorMessage={offlineReason}
        onRetry={handleRetry}
      />

      {/* Live Network Stats - animated ticker */}
      {networkStats && networkStats.blockHeight > 0 && (
        <LiveStatsTicker stats={networkStats} compact className="telemetry-live-stats" />
      )}

      {/* Bitcoin Node Card with detailed info */}
      {nodeInfoWithConfig && (
        <div className="telemetry-node-section">
          <BitcoinNodeCard info={nodeInfoWithConfig} />
        </div>
      )}

      {/* Connected Relays */}
      <div className="telemetry-relays" aria-label="Connected relays">
        <div className="telemetry-relays-title">
          Connected Relays
          <span className="telemetry-relay-count">
            {relaysLoading ? '...' : activeRelays.length}
          </span>
        </div>
        <div className="telemetry-relays-list">
          {relaysLoading ? (
            <div style={{ padding: '0.5rem' }}>
              <Skeleton variant="text" height={16} style={{ marginBottom: '0.25rem' }} />
              <Skeleton variant="text" height={16} style={{ marginBottom: '0.25rem' }} />
              <Skeleton variant="text" height={16} />
            </div>
          ) : activeRelays.length === 0 ? (
            <div className="telemetry-relays-empty">No relays connected</div>
          ) : (
            activeRelays.slice(0, 5).map((relay) => (
              <div key={relay} className="telemetry-relay-item">
                <div className="telemetry-relay-dot telemetry-relay-dot--connected" />
                {relay.replace(/^wss?:\/\//, '')}
              </div>
            ))
          )}
          {activeRelays.length > 5 && (
            <div className="telemetry-relay-more">+{activeRelays.length - 5} more</div>
          )}
        </div>
      </div>

      {/* Activity Log - enhanced with virtualization and micro-interactions */}
      <ActivityLog events={activityEvents} maxEvents={LOG_LIMIT} height={300} />
    </div>
  );
}
