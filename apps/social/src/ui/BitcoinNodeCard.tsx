import { Alert } from '@nostrstack/ui';
import { type HTMLAttributes, useEffect, useState } from 'react';

import { AnimatedBlockHeight, AnimatedNumber } from './AnimatedNumber';

type LnbitsHealth = {
  status?: string;
  reason?: string;
  error?: string;
  httpStatus?: number;
  elapsedMs?: number;
};

type NodeInfo = {
  network?: string;
  configuredNetwork?: string;
  source?: string;
  height?: number;
  hash?: string;
  time?: number;
  interval?: number;
  mempoolTxs?: number;
  mempoolBytes?: number;
  version?: string | number;
  connections?: number;
  headers?: number;
  blocks?: number;
  verificationProgress?: number;
  initialBlockDownload?: boolean;
  telemetryError?: string;
  lightning?: {
    provider?: string;
    lnbits?: LnbitsHealth;
  };
};

// Use CSS custom property for Bitcoin orange color - see gallery.css for --ns-color-bitcoin-default
const BITCOIN_ORANGE = 'var(--ns-color-bitcoin-default)';

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '--';
  const mb = bytes / 1_000_000;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

function formatAge(time?: number): string {
  if (!time) return '--';
  const delta = Math.max(0, Math.floor(Date.now() / 1000 - time));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function formatProgress(progress?: number): string {
  if (progress === undefined || progress === null) return '--';
  return `${(progress * 100).toFixed(2)}%`;
}

function useTimeSinceBlock(time?: number) {
  const [elapsed, setElapsed] = useState<string>('--');
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!time) {
      setElapsed('--');
      setCountdown(null);
      return;
    }

    const updateElapsed = () => {
      const delta = Math.max(0, Math.floor(Date.now() / 1000 - time));
      setElapsed(formatAge(time));

      // Estimate next block (average 10 min for mainnet, varies for regtest)
      const avgBlockTime = 600; // 10 minutes
      const remaining = Math.max(0, avgBlockTime - delta);
      setCountdown(remaining > 0 ? remaining : null);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [time]);

  return { elapsed, countdown };
}

export function BitcoinNodeCard({
  info,
  className,
  ...props
}: { info: NodeInfo } & HTMLAttributes<HTMLDivElement>) {
  const networkRaw = (info.configuredNetwork ?? info.network ?? '').toLowerCase();
  const isMainnet = networkRaw === 'mainnet' || networkRaw === 'main';
  const isTestnet = ['test', 'testnet', 'mutinynet', 'signet'].includes(networkRaw);
  const isRegtest = networkRaw === 'regtest';

  let networkColor = 'var(--ns-color-text-muted)';
  if (isMainnet) networkColor = 'var(--ns-color-success-default)';
  if (isTestnet) networkColor = 'var(--ns-color-warning-default)';
  if (isRegtest) networkColor = 'var(--ns-color-primary-default)';

  const networkLabel = (info.configuredNetwork ?? info.network)?.toUpperCase() || 'OFFLINE';
  const chainLabel =
    info.network && info.configuredNetwork && info.network !== info.configuredNetwork
      ? info.network.toUpperCase()
      : null;
  const sourceLabel = info.source ? info.source.toUpperCase() : null;

  const mempoolTxs = info.mempoolTxs != null ? info.mempoolTxs : null;
  const mempoolBytes = info.mempoolBytes != null ? formatBytes(info.mempoolBytes) : '--';

  const syncProgress = formatProgress(info.verificationProgress);
  const blockHeaderLabel =
    info.blocks != null && info.headers != null
      ? `${info.blocks.toLocaleString()}/${info.headers.toLocaleString()}`
      : null;
  const syncValue = blockHeaderLabel ? `${syncProgress} (${blockHeaderLabel})` : syncProgress;
  const isSyncing =
    Boolean(info.initialBlockDownload) ||
    (typeof info.verificationProgress === 'number' && info.verificationProgress < 0.999);
  const syncState = isSyncing ? 'Syncing' : 'Synced';

  const provider = info.lightning?.provider;
  const lnbitsStatus = info.lightning?.lnbits?.status;
  let lightningLabel = provider ? `Provider: ${provider}` : 'Provider: --';
  let lightningTone: 'muted' | 'success' | 'danger' = 'muted';
  if (provider === 'lnbits') {
    if (lnbitsStatus === 'ok') {
      lightningLabel = 'LNbits: OK';
      lightningTone = 'success';
    } else if (lnbitsStatus === 'fail' || lnbitsStatus === 'error') {
      lightningLabel = `LNbits: ${lnbitsStatus.toUpperCase()}`;
      lightningTone = 'danger';
    } else if (lnbitsStatus === 'skipped') {
      lightningLabel = 'LNbits: Skipped';
    } else {
      lightningLabel = 'LNbits: Unknown';
    }
  }

  const { elapsed, countdown } = useTimeSinceBlock(info.time);
  const hasLiveData = info.height != null && info.height > 0;

  return (
    <div className={`ns-node-card ns-node-card--bitcoin ${className || ''}`} {...props}>
      {/* Bitcoin Orange Accent Bar */}
      <div className="ns-node-accent" style={{ background: BITCOIN_ORANGE }} aria-hidden="true" />

      <div className="ns-node-header">
        <div className="ns-node-title">
          <span className="ns-node-icon ns-node-icon--bitcoin" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-1.67v-1.85c-.99-.09-1.99-.38-2.68-.74l.43-1.72c.77.35 1.74.68 2.6.68.78 0 1.23-.27 1.23-.74 0-.45-.39-.69-1.4-1.02-1.45-.46-2.51-1.14-2.51-2.52 0-1.21.86-2.16 2.33-2.46V8h1.67v1.58c.69.08 1.44.27 2.05.54l-.38 1.67c-.57-.24-1.26-.48-2-.48-.89 0-1.11.37-1.11.65 0 .38.4.6 1.56 1.05 1.68.61 2.37 1.41 2.37 2.61 0 1.23-.88 2.22-2.49 2.47z" />
            </svg>
          </span>
          Bitcoin Node
          {hasLiveData && (
            <span className="ns-node-live-indicator" title="Receiving live data">
              <span className="ns-node-live-dot" />
              LIVE
            </span>
          )}
        </div>
        <div className="ns-node-badges">
          <div
            className="ns-node-badge ns-node-badge--network"
            style={{ '--node-network-color': networkColor } as React.CSSProperties}
          >
            {networkLabel}
          </div>
          {sourceLabel && <div className="ns-node-badge">{sourceLabel}</div>}
        </div>
      </div>
      {chainLabel && <div className="ns-node-subtitle">Chain: {chainLabel}</div>}

      <div className="ns-node-grid">
        {/* Block Height - Featured prominently */}
        <div className="ns-stat ns-stat--featured ns-stat--full">
          <div className="ns-stat-label">
            <span className="ns-stat-label-icon" style={{ color: BITCOIN_ORANGE }}>
              #
            </span>
            Block Height
          </div>
          <div className="ns-stat-value ns-stat-value--xl ns-stat-value--bitcoin">
            {info.height != null ? <AnimatedBlockHeight value={info.height} /> : '--'}
          </div>
        </div>

        <div className="ns-stat">
          <div className="ns-stat-label">Peers</div>
          <div className="ns-stat-value">
            {info.connections != null ? (
              <AnimatedNumber value={info.connections} duration={300} />
            ) : (
              '--'
            )}
          </div>
        </div>

        <div className="ns-stat">
          <div className="ns-stat-label">Last Block</div>
          <div className="ns-stat-value ns-stat-value--live">{elapsed}</div>
          {countdown != null && countdown > 0 && (
            <div className="ns-stat-hint">~{Math.floor(countdown / 60)}m until next</div>
          )}
        </div>

        {/* Mempool Section */}
        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">
            <span className="ns-stat-label-icon">M</span>
            Mempool
          </div>
          <div className="ns-stat-value ns-stat-value--mempool">
            {mempoolTxs != null ? (
              <>
                <AnimatedNumber value={mempoolTxs} duration={300} />
                <span className="ns-stat-value-unit">tx</span>
                <span className="ns-stat-value-sep">/</span>
                <span className="ns-stat-value-secondary">{mempoolBytes}</span>
              </>
            ) : (
              '--'
            )}
          </div>
        </div>

        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">Sync</div>
          <div className="ns-stat-value sm">
            {syncValue}{' '}
            <span
              className={`ns-sync-badge ${isSyncing ? 'ns-sync-badge--syncing' : 'ns-sync-badge--synced'}`}
            >
              {syncState}
            </span>
          </div>
        </div>

        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">Version</div>
          <div className="ns-stat-value sm">
            {info.version != null ? String(info.version) : '--'}
          </div>
        </div>

        {/* Lightning Section */}
        <div className="ns-stat ns-stat--full ns-stat--lightning">
          <div className="ns-stat-label">
            <span className="ns-stat-label-icon ns-stat-label-icon--lightning">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
              </svg>
            </span>
            Lightning
          </div>
          <div className={`ns-status ns-status--${lightningTone}`}>{lightningLabel}</div>
        </div>
      </div>

      {info.telemetryError && (
        <Alert tone="warning" title="Telemetry degraded" className="ns-node-alert">
          {info.telemetryError}
        </Alert>
      )}

      {info.hash && (
        <div className="ns-hash-bar">
          <div className="ns-stat-label">Tip Hash</div>
          <code className="ns-hash-value">
            {info.hash.slice(0, 12)}...{info.hash.slice(-12)}
          </code>
        </div>
      )}
    </div>
  );
}
