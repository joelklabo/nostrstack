import { Skeleton } from '@nostrstack/ui';

/**
 * Skeleton loading state for the BitcoinNodeCard component.
 * Displays shimmer animations that match the card layout while data loads.
 * Respects prefers-reduced-motion for accessibility.
 */
export function BitcoinNodeCardSkeleton() {
  return (
    <div
      className="ns-node-card ns-node-card--bitcoin ns-node-card--skeleton"
      aria-busy="true"
      aria-label="Loading Bitcoin node status"
    >
      {/* Bitcoin Orange Accent Bar - static during loading */}
      <div
        className="ns-node-accent"
        style={{ background: 'var(--ns-color-bg-muted)' }}
        aria-hidden="true"
      />

      <div className="ns-node-header">
        <div className="ns-node-title">
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="ns-node-badges">
          <Skeleton width={70} height={20} borderRadius="var(--ns-radius-full)" />
        </div>
      </div>

      <div className="ns-node-grid">
        {/* Block Height - Featured prominently */}
        <div className="ns-stat ns-stat--featured ns-stat--full">
          <div className="ns-stat-label">
            <Skeleton width={80} height={12} />
          </div>
          <div className="ns-stat-value ns-stat-value--xl">
            <Skeleton width={120} height={32} />
          </div>
        </div>

        <div className="ns-stat">
          <div className="ns-stat-label">
            <Skeleton width={40} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={30} height={18} />
          </div>
        </div>

        <div className="ns-stat">
          <div className="ns-stat-label">
            <Skeleton width={60} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={50} height={18} />
          </div>
        </div>

        {/* Mempool Section */}
        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">
            <Skeleton width={60} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={140} height={18} />
          </div>
        </div>

        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">
            <Skeleton width={35} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={100} height={16} />
          </div>
        </div>

        <div className="ns-stat ns-stat--full">
          <div className="ns-stat-label">
            <Skeleton width={50} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={80} height={16} />
          </div>
        </div>

        {/* Lightning Section */}
        <div className="ns-stat ns-stat--full ns-stat--lightning">
          <div className="ns-stat-label">
            <Skeleton width={65} height={12} />
          </div>
          <div className="ns-stat-value">
            <Skeleton width={90} height={16} />
          </div>
        </div>
      </div>

      {/* Hash Bar */}
      <div className="ns-hash-bar">
        <div className="ns-stat-label">
          <Skeleton width={55} height={12} />
        </div>
        <Skeleton width="100%" height={28} borderRadius="var(--ns-radius-sm)" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the relays section while loading.
 */
export function RelaysSkeleton() {
  return (
    <div className="telemetry-relays telemetry-relays--skeleton" aria-busy="true">
      <div className="telemetry-relays-title">
        <Skeleton width={100} height={12} />
        <Skeleton
          width={24}
          height={20}
          borderRadius="var(--ns-radius-full)"
          className="telemetry-relay-count"
        />
      </div>
      <div className="telemetry-relays-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="telemetry-relay-item">
            <Skeleton variant="circular" width={6} height={6} />
            <Skeleton width={`${70 + i * 10}%`} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the activity log section while loading.
 */
export function ActivityLogSkeleton() {
  return (
    <div className="telemetry-log telemetry-log--skeleton" aria-busy="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="telemetry-log-entry">
          <Skeleton width={14} height={14} className="telemetry-log-icon" />
          <Skeleton width={50} height={12} className="telemetry-log-time" />
          <Skeleton width={`${50 + i * 8}%`} height={12} />
        </div>
      ))}
    </div>
  );
}
