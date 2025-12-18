import { type HTMLAttributes } from 'react';

type NodeInfo = {
  network?: string;
  height?: number;
  version?: string;
  connections?: number;
  hash?: string;
};

export function BitcoinNodeCard({ info, className, ...props }: { info: NodeInfo } & HTMLAttributes<HTMLDivElement>) {
  const isMainnet = info.network === 'main';
  const isTestnet = info.network === 'test' || info.network === 'testnet';
  const isRegtest = info.network === 'regtest';
  
  let networkColor = 'var(--nostrstack-color-text-muted)';
  if (isMainnet) networkColor = 'var(--nostrstack-color-success)';
  if (isTestnet) networkColor = 'var(--nostrstack-color-warning)';
  if (isRegtest) networkColor = 'var(--nostrstack-color-info)';

  return (
    <div className={`nostrstack-card nostrstack-node-card ${className || ''}`} {...props}>
      <div className="nostrstack-node-header">
        <div className="nostrstack-node-title">
          <span className="nostrstack-node-icon">₿</span>
          BITCOIN_NODE
        </div>
        <div className="nostrstack-badge" style={{ borderColor: networkColor, color: networkColor }}>
          {info.network?.toUpperCase() || 'OFFLINE'}
        </div>
      </div>
      
      <div className="nostrstack-node-grid">
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">BLOCK_HEIGHT</div>
          <div className="nostrstack-stat-value" style={{ fontSize: '1.2rem', color: 'var(--nostrstack-color-primary)' }}>
            {info.height?.toLocaleString() ?? '—'}
          </div>
        </div>
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">PEERS</div>
          <div className="nostrstack-stat-value">
            {info.connections ?? '—'}
          </div>
        </div>
        <div className="nostrstack-stat full-width">
          <div className="nostrstack-stat-label">VERSION</div>
          <div className="nostrstack-stat-value sm" style={{ color: 'var(--nostrstack-color-text-muted)' }}>
            {info.version ?? '—'}
          </div>
        </div>
      </div>
      
      {info.hash && (
        <div className="nostrstack-hash-bar">
          <div className="nostrstack-hash-label">TIP_HASH</div>
          <code className="nostrstack-code" style={{ fontSize: '0.75rem', color: 'var(--nostrstack-color-text-dim)' }}>
            {info.hash.slice(0, 12)}...{info.hash.slice(-12)}
          </code>
        </div>
      )}
    </div>
  );
}
