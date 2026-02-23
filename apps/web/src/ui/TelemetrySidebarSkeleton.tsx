import { Skeleton } from '@nostrstack/ui';
import type { ReactNode } from 'react';

import {
  ActivityLogSkeleton,
  BitcoinNodeCardSkeleton,
  RelaysSkeleton
} from './BitcoinNodeCardSkeleton';

type LoadingState = 'loading' | 'loaded' | 'error' | 'stale';

interface SectionState {
  node: LoadingState;
  relays: LoadingState;
  log: LoadingState;
}

interface SectionContent {
  node?: ReactNode;
  relays?: ReactNode;
  log?: ReactNode;
}

interface TelemetrySidebarSkeletonProps {
  /** Which sections are in which loading state */
  sectionStates?: Partial<SectionState>;
  /** Render content for loaded sections */
  sections?: SectionContent;
}

/**
 * Full skeleton for the telemetry sidebar during initial load.
 * Shows all sections in loading state with shimmer animations.
 */
export function TelemetrySidebarSkeleton({
  sectionStates = {},
  sections = {}
}: TelemetrySidebarSkeletonProps = {}) {
  const states: SectionState = {
    node: sectionStates.node ?? 'loading',
    relays: sectionStates.relays ?? 'loading',
    log: sectionStates.log ?? 'loading'
  };

  return (
    <div className="telemetry-sidebar" aria-busy="true" aria-label="Loading telemetry sidebar">
      {/* Status Row Skeleton */}
      <div className="telemetry-status-row">
        <span className="telemetry-status" data-status="connecting">
          <span className="telemetry-status-dot" />
          <Skeleton width={70} height={12} />
        </span>
        <span className="telemetry-status-time">
          <Skeleton width={80} height={10} />
        </span>
      </div>

      {/* Node Section */}
      <div className="telemetry-node-section">
        {states.node === 'loading' ? (
          <BitcoinNodeCardSkeleton />
        ) : states.node === 'error' ? (
          <SectionError message="Failed to load Bitcoin node status" />
        ) : (
          sections.node
        )}
      </div>

      {/* Relays Section */}
      {states.relays === 'loading' ? (
        <RelaysSkeleton />
      ) : states.relays === 'error' ? (
        <SectionError message="Failed to load relay status" />
      ) : (
        sections.relays
      )}

      {/* Activity Log Header */}
      <div className="telemetry-header">
        <span>Activity Log</span>
        <Skeleton width={70} height={24} borderRadius="var(--ns-radius-sm)" />
      </div>

      {/* Activity Log */}
      {states.log === 'loading' ? (
        <ActivityLogSkeleton />
      ) : states.log === 'error' ? (
        <SectionError message="Failed to load activity log" />
      ) : (
        sections.log
      )}
    </div>
  );
}

/**
 * Compact error state for individual sections.
 */
function SectionError({ message }: { message: string }) {
  return (
    <div className="telemetry-section-error" role="alert">
      <span className="telemetry-section-error-icon" aria-hidden="true">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Reconnecting indicator with progress animation.
 * Shows current attempt and visual feedback during reconnection.
 */
export function ReconnectingIndicator({
  attempt,
  maxAttempts,
  nextRetryMs
}: {
  attempt: number;
  maxAttempts: number;
  nextRetryMs?: number;
}) {
  const progress = Math.min((attempt / maxAttempts) * 100, 100);

  return (
    <div
      className="telemetry-reconnecting"
      role="status"
      aria-live="polite"
      aria-label={`Reconnecting, attempt ${attempt} of ${maxAttempts}`}
    >
      <div className="telemetry-reconnecting-header">
        <span className="telemetry-reconnecting-icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </span>
        <span className="telemetry-reconnecting-text">
          Reconnecting ({attempt}/{maxAttempts})
        </span>
      </div>
      <div className="telemetry-reconnecting-progress">
        <div
          className="telemetry-reconnecting-progress-bar"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={attempt}
          aria-valuemin={0}
          aria-valuemax={maxAttempts}
        />
      </div>
      {nextRetryMs !== undefined && nextRetryMs > 0 && (
        <div className="telemetry-reconnecting-countdown">
          Next attempt in {Math.ceil(nextRetryMs / 1000)}s
        </div>
      )}
    </div>
  );
}

/**
 * Stale data indicator with visual warning.
 * Shows when data may be outdated due to connection issues.
 */
export function StaleDataIndicator({
  lastUpdateMs,
  onRetry
}: {
  lastUpdateMs?: number;
  onRetry?: () => void;
}) {
  const timeSince = lastUpdateMs ? formatTimeSince(lastUpdateMs) : 'unknown';

  return (
    <div className="telemetry-stale-indicator" role="alert" aria-live="polite">
      <div className="telemetry-stale-header">
        <span className="telemetry-stale-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </span>
        <span className="telemetry-stale-text">Data may be outdated</span>
      </div>
      <div className="telemetry-stale-detail">Last updated {timeSince}</div>
      {onRetry && (
        <button
          type="button"
          className="telemetry-stale-retry"
          onClick={onRetry}
          aria-label="Refresh data"
        >
          Refresh
        </button>
      )}
    </div>
  );
}

/**
 * Format time since last update in human-readable form.
 */
function formatTimeSince(timestamp: number): string {
  const now = Date.now();
  const delta = Math.floor((now - timestamp) / 1000);

  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

/**
 * Partial loading state wrapper.
 * Shows skeleton for specific sections while others have loaded.
 * Prefixed with underscore to indicate intentionally unused (for future use).
 */
function _PartialLoadingWrapper({
  isLoading,
  skeleton,
  children
}: {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
}
