import { Alert } from '@nostrstack/ui';
import { type HTMLAttributes } from 'react';

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

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—';
  const mb = bytes / 1_000_000;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

function formatAge(time?: number): string {
  if (!time) return '—';
  const delta = Math.max(0, Math.floor(Date.now() / 1000 - time));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function formatProgress(progress?: number): string {
  if (progress === undefined || progress === null) return '—';
  return `${(progress * 100).toFixed(2)}%`;
}

export function BitcoinNodeCard({ info, className, ...props }: { info: NodeInfo } & HTMLAttributes<HTMLDivElement>) {
  const networkRaw = (info.configuredNetwork ?? info.network ?? '').toLowerCase();
  const isMainnet = networkRaw === 'mainnet' || networkRaw === 'main';
  const isTestnet = ['test', 'testnet', 'mutinynet', 'signet'].includes(networkRaw);
  const isRegtest = networkRaw === 'regtest';

  let networkColor = 'var(--color-fg-muted)';
  if (isMainnet) networkColor = 'var(--color-success-fg)';
  if (isTestnet) networkColor = 'var(--color-attention-fg)';
  if (isRegtest) networkColor = 'var(--color-accent-fg)';

  const networkLabel = (info.configuredNetwork ?? info.network)?.toUpperCase() || 'OFFLINE';
  const chainLabel =
    info.network && info.configuredNetwork && info.network !== info.configuredNetwork
      ? info.network.toUpperCase()
      : null;
  const sourceLabel = info.source ? info.source.toUpperCase() : null;

  const mempoolTxs = info.mempoolTxs != null ? info.mempoolTxs.toLocaleString() : '—';
  const mempoolBytes = info.mempoolBytes != null ? formatBytes(info.mempoolBytes) : '—';
  const mempoolValue =
    info.mempoolTxs != null || info.mempoolBytes != null ? `${mempoolTxs} tx / ${mempoolBytes}` : '—';

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
  let lightningLabel = provider ? `Provider: ${provider}` : 'Provider: —';
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

  return (
    <div className={`nostrstack-node-card ${className || ''}`} {...props}>
      <div className="nostrstack-node-header">
        <div className="nostrstack-node-title">
          <span className="nostrstack-node-icon">₿</span>
          Bitcoin Node
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              padding: '2px 6px',
              borderRadius: '10px',
              border: `1px solid ${networkColor}`,
              color: networkColor,
              backgroundColor: 'var(--color-canvas-subtle)'
            }}
          >
            {networkLabel}
          </div>
          {sourceLabel && (
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-fg-muted)',
                backgroundColor: 'var(--color-canvas-subtle)'
              }}
            >
              {sourceLabel}
            </div>
          )}
        </div>
      </div>
      {chainLabel && <div className="nostrstack-node-subtitle">Chain: {chainLabel}</div>}

      <div className="nostrstack-node-grid">
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Block Height</div>
          <div className="nostrstack-stat-value" style={{ fontSize: '1.2rem' }}>
            {info.height?.toLocaleString() ?? '—'}
          </div>
        </div>
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Peers</div>
          <div className="nostrstack-stat-value">{info.connections ?? '—'}</div>
        </div>
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Mempool</div>
          <div className="nostrstack-stat-value">{mempoolValue}</div>
        </div>
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Last Block</div>
          <div className="nostrstack-stat-value">{formatAge(info.time)}</div>
        </div>
        <div className="nostrstack-stat" style={{ gridColumn: '1 / -1' }}>
          <div className="nostrstack-stat-label">Sync</div>
          <div className="nostrstack-stat-value sm">
            {syncValue} ({syncState})
          </div>
        </div>
        <div className="nostrstack-stat" style={{ gridColumn: '1 / -1' }}>
          <div className="nostrstack-stat-label">Version</div>
          <div className="nostrstack-stat-value sm">{info.version != null ? String(info.version) : '—'}</div>
        </div>
        <div className="nostrstack-stat" style={{ gridColumn: '1 / -1' }}>
          <div className="nostrstack-stat-label">Lightning</div>
          <div className={`nostrstack-status nostrstack-status--${lightningTone}`}>{lightningLabel}</div>
        </div>
      </div>

      {info.telemetryError && (
        <Alert tone="warning" title="Telemetry degraded" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {info.telemetryError}
        </Alert>
      )}

      {info.hash && (
        <div className="nostrstack-hash-bar">
          <div className="nostrstack-stat-label">Tip Hash</div>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>
            {info.hash.slice(0, 12)}...{info.hash.slice(-12)}
          </code>
        </div>
      )}
    </div>
  );
}
