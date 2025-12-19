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
  
  let networkColor = 'var(--color-fg-muted)';
  if (isMainnet) networkColor = 'var(--color-success-fg)';
  if (isTestnet) networkColor = 'var(--color-attention-fg)';
  if (isRegtest) networkColor = 'var(--color-accent-fg)';

  return (
    <div className={`nostrstack-node-card ${className || ''}`} {...props}>
      <div className="nostrstack-node-header">
        <div className="nostrstack-node-title">
          <span className="nostrstack-node-icon">₿</span>
          Bitcoin Node
        </div>
        <div style={{ 
          fontSize: '0.7rem', 
          fontWeight: '600', 
          padding: '2px 6px', 
          borderRadius: '10px', 
          border: `1px solid ${networkColor}`, 
          color: networkColor,
          backgroundColor: 'var(--color-canvas-subtle)'
        }}>
          {info.network?.toUpperCase() || 'OFFLINE'}
        </div>
      </div>
      
      <div className="nostrstack-node-grid">
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Block Height</div>
          <div className="nostrstack-stat-value" style={{ fontSize: '1.2rem' }}>
            {info.height?.toLocaleString() ?? '—'}
          </div>
        </div>
        <div className="nostrstack-stat">
          <div className="nostrstack-stat-label">Peers</div>
          <div className="nostrstack-stat-value">
            {info.connections ?? '—'}
          </div>
        </div>
        <div className="nostrstack-stat" style={{ gridColumn: '1 / -1' }}>
          <div className="nostrstack-stat-label">Version</div>
          <div className="nostrstack-stat-value sm">
            {info.version ?? '—'}
          </div>
        </div>
      </div>
      
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