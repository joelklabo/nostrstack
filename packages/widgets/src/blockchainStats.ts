import { ensureNsRoot } from './styles.js';
import { isMockBase, resolveApiBaseUrl, resolveTelemetryWs } from './url-utils.js';

type TelemetrySummary = {
  type?: 'block';
  height?: number;
  hash?: string;
  time?: number;
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
};

type TelemetryEvent = TelemetrySummary | { type: 'error'; message: string; time?: number };

export type BlockchainStatsOptions = {
  baseURL?: string;
  host?: string;
  title?: string;
};

const MAX_AUTO_RECONNECT_ATTEMPTS = 5;

const formatNumber = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  } catch {
    return String(Math.round(value));
  }
};

const formatBytes = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const mb = value / 1_000_000;
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const formatAge = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
};

const buildMockSummary = (): TelemetrySummary => ({
  type: 'block',
  height: 820000,
  hash: '000000000000000000035c1ec826f03027878434757045197825310657158739',
  time: Math.floor(Date.now() / 1000),
  txs: 2500,
  size: 1500000,
  weight: 3990000,
  interval: 600,
  mempoolTxs: 15000,
  mempoolBytes: 35000000,
  network: 'mocknet',
  version: 70016,
  subversion: '/Satoshi:26.0.0/',
  connections: 8
});

export function renderBlockchainStats(container: HTMLElement, opts: BlockchainStatsOptions = {}) {
  ensureNsRoot(container);
  container.classList.add('ns-card', 'ns-blockchain-stats');
  container.replaceChildren();

  const header = document.createElement('div');
  header.className = 'ns-blockchain-stats__header';

  const title = document.createElement('div');
  title.className = 'ns-blockchain-stats__title';
  title.textContent = opts.title ?? 'Blockchain';

  const status = document.createElement('div');
  status.className = 'ns-status ns-status--muted ns-blockchain-stats__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading…';

  header.append(title, status);

  const grid = document.createElement('div');
  grid.className = 'ns-blockchain-stats__grid';

  const createStat = (label: string, key: string) => {
    const stat = document.createElement('div');
    stat.className = 'ns-blockchain-stat';

    const value = document.createElement('div');
    value.className = 'ns-blockchain-value';
    value.dataset.stat = key;
    value.textContent = '—';

    const labelEl = document.createElement('div');
    labelEl.className = 'ns-blockchain-label';
    labelEl.textContent = label;

    stat.append(value, labelEl);
    grid.append(stat);
    return value;
  };

  const heightValue = createStat('Height', 'height');
  const mempoolTxsValue = createStat('Mempool txs', 'mempoolTxs');
  const mempoolBytesValue = createStat('Mempool size', 'mempoolBytes');
  const networkValue = createStat('Network', 'network');

  const actions = document.createElement('div');
  actions.className = 'ns-blockchain-actions';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'ns-btn ns-btn--ghost ns-btn--sm';
  retry.textContent = 'Retry';
  retry.hidden = true;

  actions.append(retry);

  container.append(header, grid, actions);

  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  const wsUrl = resolveTelemetryWs(opts.baseURL);
  const mockMode = isMockBase(opts.baseURL);

  let hasData = false;
  let wsConnected = false;
  let lastUpdatedAt: number | null = null;
  let errorMessage: string | null = null;
  let statusTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectDelay = 2000;
  let reconnectAttempts = 0;
  let ws: WebSocket | null = null;
  let destroyed = false;
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleOnline = () => {
    if (destroyed) return;
    isOnline = true;
    reconnectAttempts = 0;
    reconnectDelay = 2000;
    hydrate();
    if (!wsConnected) connectWebSocket();
  };

  const handleOffline = () => {
    if (destroyed) return;
    isOnline = false;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
    wsConnected = false;
    errorMessage = errorMessage ?? 'Browser offline';
    renderStatus();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  const setStatusClass = (tone: 'muted' | 'success' | 'danger') => {
    status.classList.remove('ns-status--muted', 'ns-status--success', 'ns-status--danger');
    status.classList.add(`ns-status--${tone}`);
  };

  const renderStatus = () => {
    if (destroyed) return;
    if (errorMessage && !hasData) {
      status.textContent = errorMessage;
      setStatusClass('danger');
      retry.hidden = false;
      return;
    }

    const age = lastUpdatedAt ? formatAge(Date.now() - lastUpdatedAt) : null;

    if (mockMode) {
      status.textContent = 'Mock data';
      setStatusClass('muted');
    } else if (!hasData) {
      status.textContent = 'Loading…';
      setStatusClass('muted');
    } else if (wsConnected) {
      status.textContent = `Live · updated ${age ?? '—'} ago`;
      setStatusClass('success');
    } else {
      const suffix = errorMessage ? ` · ${errorMessage}` : '';
      status.textContent = `Stale · updated ${age ?? '—'} ago${suffix}`;
      setStatusClass('muted');
    }

    retry.hidden = !errorMessage;
  };

  const updateFromSummary = (summary: TelemetrySummary) => {
    heightValue.textContent = formatNumber(summary.height);
    mempoolTxsValue.textContent = formatNumber(summary.mempoolTxs);
    mempoolBytesValue.textContent = formatBytes(summary.mempoolBytes);
    networkValue.textContent = summary.network ?? '—';
    hasData = true;
    lastUpdatedAt = Date.now();
    errorMessage = null;
    renderStatus();
  };

  const hydrate = async () => {
    if (destroyed) return;
    if (mockMode) {
      updateFromSummary(buildMockSummary());
      return;
    }
    errorMessage = null;
    renderStatus();
    retry.disabled = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/telemetry/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as TelemetrySummary;
      updateFromSummary(body);
    } catch (err) {
      console.warn('telemetry summary fetch failed', err);
      errorMessage = 'Telemetry unavailable';
      renderStatus();
    } finally {
      retry.disabled = false;
    }
  };

  const scheduleReconnect = () => {
    if (!wsUrl || destroyed) return;
    if (reconnectTimer) return;
    if (!isOnline) {
      errorMessage = 'Browser offline';
      renderStatus();
      return;
    }
    if (reconnectAttempts >= MAX_AUTO_RECONNECT_ATTEMPTS) {
      errorMessage = errorMessage ?? 'Live updates paused';
      renderStatus();
      return;
    }
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempts += 1;
      connectWebSocket();
    }, reconnectDelay);
    reconnectDelay = Math.min(30000, reconnectDelay * 2);
  };

  const connectWebSocket = () => {
    if (!wsUrl || destroyed) return;
    if (typeof WebSocket === 'undefined') return;
    if (!isOnline) {
      errorMessage = 'Browser offline';
      renderStatus();
      return;
    }
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    ws.onopen = () => {
      wsConnected = true;
      reconnectDelay = 2000;
      reconnectAttempts = 0;
      renderStatus();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as TelemetryEvent;
        if (!payload || typeof payload !== 'object') return;
        if (payload.type === 'error') {
          errorMessage = payload.message ?? 'Telemetry unavailable';
          renderStatus();
          return;
        }
        updateFromSummary(payload);
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      wsConnected = false;
      renderStatus();
    };

    ws.onclose = () => {
      wsConnected = false;
      renderStatus();
      scheduleReconnect();
    };
  };

  const handleRetry = () => {
    reconnectAttempts = 0;
    reconnectDelay = 2000;
    hydrate();
    if (!wsConnected) scheduleReconnect();
  };

  retry.addEventListener('click', handleRetry);

  hydrate();
  connectWebSocket();

  if (typeof window !== 'undefined') {
    statusTimer = window.setInterval(renderStatus, 15000);
  }

  return {
    refresh: hydrate,
    destroy: () => {
      destroyed = true;
      retry.removeEventListener('click', handleRetry);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      if (statusTimer) {
        window.clearInterval(statusTimer);
        statusTimer = null;
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    }
  };
}
