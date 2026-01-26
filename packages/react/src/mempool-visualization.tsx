'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Types
export type CongestionLevel = 'low' | 'medium' | 'high';

export type MempoolData = {
  txCount: number;
  sizeVMB: number;
  feeRates: {
    low: number; // sat/vB for low priority
    medium: number; // sat/vB for medium priority
    high: number; // sat/vB for high priority
  };
  lastUpdated?: number;
};

export type MempoolVisualizationProps = {
  /** Initial data to display */
  data?: MempoolData;
  /** Polling interval in ms (default: 30000) */
  pollInterval?: number;
  /** API endpoint to fetch mempool data */
  apiEndpoint?: string;
  /** Custom fetch function for mempool data */
  fetchData?: () => Promise<MempoolData>;
  /** Callback when data updates */
  onDataUpdate?: (data: MempoolData) => void;
  /** Additional CSS class */
  className?: string;
  /** Show compact mode (single row) */
  compact?: boolean;
};

// Utility functions
const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
};

const formatSize = (vmb: number): string => {
  if (!Number.isFinite(vmb)) return '--';
  if (vmb >= 1000) return `${(vmb / 1000).toFixed(1)} GB`;
  return `${vmb.toFixed(1)} vMB`;
};

const formatFee = (satPerVb: number): string => {
  if (!Number.isFinite(satPerVb)) return '--';
  return `${Math.round(satPerVb)} sat/vB`;
};

const getCongestionLevel = (data: MempoolData): CongestionLevel => {
  // Determine congestion based on mempool size and fee rates
  // Low: < 50 vMB or low fee < 5 sat/vB
  // Medium: 50-200 vMB or low fee 5-20 sat/vB
  // High: > 200 vMB or low fee > 20 sat/vB
  if (data.sizeVMB > 200 || data.feeRates.low > 20) return 'high';
  if (data.sizeVMB > 50 || data.feeRates.low > 5) return 'medium';
  return 'low';
};

const getCongestionLabel = (level: CongestionLevel): string => {
  switch (level) {
    case 'low':
      return 'Low congestion';
    case 'medium':
      return 'Moderate congestion';
    case 'high':
      return 'High congestion';
  }
};

// Default mock data
const DEFAULT_DATA: MempoolData = {
  txCount: 0,
  sizeVMB: 0,
  feeRates: { low: 1, medium: 2, high: 5 }
};

// Styles
const styles = `
.ns-mempool {
  --ns-mempool-width: 280px;
  --ns-mempool-congestion-low: var(--ns-color-success-default, oklch(0.62 0.19 155));
  --ns-mempool-congestion-medium: var(--ns-color-warning-default, oklch(0.75 0.18 55));
  --ns-mempool-congestion-high: var(--ns-color-danger-default, oklch(0.58 0.2 25));
  --ns-mempool-congestion-low-subtle: var(--ns-color-success-subtle, oklch(0.97 0.02 155));
  --ns-mempool-congestion-medium-subtle: var(--ns-color-warning-subtle, oklch(0.97 0.03 85));
  --ns-mempool-congestion-high-subtle: var(--ns-color-danger-subtle, oklch(0.97 0.015 25));

  width: var(--ns-mempool-width);
  max-width: 100%;
  padding: var(--ns-space-4, 1rem);
  background: var(--ns-color-surface-default, #ffffff);
  border: 1px solid var(--ns-color-border-default, oklch(0.92 0.008 280));
  border-radius: var(--ns-radius-xl, 1rem);
  box-shadow: var(--ns-shadow-sm, 0 1px 3px 0 oklch(0 0 0 / 0.06));
  font-family: var(--ns-font-family-sans, system-ui, sans-serif);
  transition: all var(--ns-duration-moderate, 200ms) var(--ns-easing-easeInOut, ease);
}

.ns-mempool:hover {
  border-color: var(--ns-color-border-strong, oklch(0.87 0.01 280));
  box-shadow: var(--ns-shadow-md, 0 4px 6px -1px oklch(0 0 0 / 0.08));
}

.ns-mempool__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ns-space-3, 0.75rem);
}

.ns-mempool__title {
  font-size: var(--ns-font-size-sm, 0.875rem);
  font-weight: var(--ns-font-weight-semibold, 600);
  color: var(--ns-color-text-default, oklch(0.18 0.02 280));
}

.ns-mempool__status {
  display: flex;
  align-items: center;
  gap: var(--ns-space-1-5, 0.375rem);
  padding: var(--ns-space-1, 0.25rem) var(--ns-space-2, 0.5rem);
  border-radius: var(--ns-radius-full, 9999px);
  font-size: var(--ns-font-size-xs, 0.75rem);
  font-weight: var(--ns-font-weight-medium, 500);
  transition: all var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease);
}

.ns-mempool__status--low {
  background: var(--ns-mempool-congestion-low-subtle);
  color: var(--ns-color-success-text, oklch(0.48 0.16 155));
}

.ns-mempool__status--medium {
  background: var(--ns-mempool-congestion-medium-subtle);
  color: var(--ns-color-warning-text, oklch(0.48 0.13 45));
}

.ns-mempool__status--high {
  background: var(--ns-mempool-congestion-high-subtle);
  color: var(--ns-color-danger-text, oklch(0.45 0.18 25));
}

.ns-mempool__status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--ns-radius-full, 9999px);
  animation: ns-mempool-pulse 2s ease-in-out infinite;
}

.ns-mempool__status--low .ns-mempool__status-dot {
  background: var(--ns-mempool-congestion-low);
}

.ns-mempool__status--medium .ns-mempool__status-dot {
  background: var(--ns-mempool-congestion-medium);
}

.ns-mempool__status--high .ns-mempool__status-dot {
  background: var(--ns-mempool-congestion-high);
  animation: ns-mempool-pulse-fast 1s ease-in-out infinite;
}

@keyframes ns-mempool-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}

@keyframes ns-mempool-pulse-fast {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.75); }
}

/* Congestion bar visualization */
.ns-mempool__congestion-bar {
  position: relative;
  height: 8px;
  background: var(--ns-color-bg-muted, oklch(0.97 0.006 280));
  border-radius: var(--ns-radius-full, 9999px);
  margin-bottom: var(--ns-space-4, 1rem);
  overflow: hidden;
}

.ns-mempool__congestion-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: var(--ns-radius-full, 9999px);
  transition: width var(--ns-duration-slow, 300ms) var(--ns-easing-emphasized, cubic-bezier(0.25, 0, 0, 1)),
              background var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease);
}

.ns-mempool__congestion-fill--low {
  background: linear-gradient(90deg, var(--ns-mempool-congestion-low), var(--ns-color-success-hover, oklch(0.55 0.18 155)));
}

.ns-mempool__congestion-fill--medium {
  background: linear-gradient(90deg, var(--ns-mempool-congestion-medium), var(--ns-color-warning-hover, oklch(0.68 0.17 50)));
}

.ns-mempool__congestion-fill--high {
  background: linear-gradient(90deg, var(--ns-mempool-congestion-high), var(--ns-color-danger-hover, oklch(0.52 0.2 25)));
}

/* Stats grid */
.ns-mempool__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ns-space-3, 0.75rem);
  margin-bottom: var(--ns-space-4, 1rem);
}

.ns-mempool__stat {
  display: flex;
  flex-direction: column;
  gap: var(--ns-space-0-5, 0.125rem);
}

.ns-mempool__stat-value {
  font-size: var(--ns-font-size-lg, 1.125rem);
  font-weight: var(--ns-font-weight-bold, 700);
  color: var(--ns-color-text-default, oklch(0.18 0.02 280));
  font-variant-numeric: tabular-nums;
  transition: color var(--ns-duration-fast, 100ms) var(--ns-easing-easeInOut, ease);
}

.ns-mempool__stat-value--updated {
  color: var(--ns-color-primary-default, oklch(0.60 0.15 185));
}

.ns-mempool__stat-label {
  font-size: var(--ns-font-size-xs, 0.75rem);
  color: var(--ns-color-text-muted, oklch(0.45 0.012 280));
}

/* Fee rates section */
.ns-mempool__fees {
  display: flex;
  flex-direction: column;
  gap: var(--ns-space-2, 0.5rem);
}

.ns-mempool__fees-title {
  font-size: var(--ns-font-size-xs, 0.75rem);
  font-weight: var(--ns-font-weight-medium, 500);
  color: var(--ns-color-text-muted, oklch(0.45 0.012 280));
  text-transform: uppercase;
  letter-spacing: var(--ns-font-letterSpacing-wide, 0.025em);
}

.ns-mempool__fee-bars {
  display: flex;
  gap: var(--ns-space-2, 0.5rem);
}

.ns-mempool__fee-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ns-space-1, 0.25rem);
  padding: var(--ns-space-2, 0.5rem);
  background: var(--ns-color-bg-subtle, oklch(0.985 0.004 280));
  border-radius: var(--ns-radius-md, 0.5rem);
  transition: all var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease);
  cursor: default;
  position: relative;
}

.ns-mempool__fee-bar:hover {
  background: var(--ns-color-bg-muted, oklch(0.97 0.006 280));
}

.ns-mempool__fee-bar-label {
  font-size: var(--ns-font-size-2xs, 0.625rem);
  font-weight: var(--ns-font-weight-medium, 500);
  color: var(--ns-color-text-subtle, oklch(0.55 0.012 280));
  text-transform: uppercase;
}

.ns-mempool__fee-bar-value {
  font-size: var(--ns-font-size-sm, 0.875rem);
  font-weight: var(--ns-font-weight-semibold, 600);
  color: var(--ns-color-text-default, oklch(0.18 0.02 280));
  font-variant-numeric: tabular-nums;
}

.ns-mempool__fee-bar--low .ns-mempool__fee-bar-value {
  color: var(--ns-mempool-congestion-low);
}

.ns-mempool__fee-bar--medium .ns-mempool__fee-bar-value {
  color: var(--ns-mempool-congestion-medium);
}

.ns-mempool__fee-bar--high .ns-mempool__fee-bar-value {
  color: var(--ns-mempool-congestion-high);
}

/* Tooltip */
.ns-mempool__tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--ns-space-1-5, 0.375rem) var(--ns-space-2, 0.5rem);
  background: var(--ns-color-bg-inverse, oklch(0.18 0.02 280));
  color: var(--ns-color-text-inverse, #ffffff);
  font-size: var(--ns-font-size-xs, 0.75rem);
  border-radius: var(--ns-radius-md, 0.5rem);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all var(--ns-duration-fast, 100ms) var(--ns-easing-easeInOut, ease);
  pointer-events: none;
  z-index: 10;
  margin-bottom: var(--ns-space-1, 0.25rem);
}

.ns-mempool__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--ns-color-bg-inverse, oklch(0.18 0.02 280));
}

.ns-mempool__fee-bar:hover .ns-mempool__tooltip {
  opacity: 1;
  visibility: visible;
}

/* Loading state */
.ns-mempool--loading .ns-mempool__stat-value,
.ns-mempool--loading .ns-mempool__fee-bar-value {
  background: linear-gradient(
    90deg,
    var(--ns-color-bg-muted) 0%,
    var(--ns-color-bg-subtle) 50%,
    var(--ns-color-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: ns-skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--ns-radius-sm, 0.25rem);
  color: transparent;
  min-width: 40px;
}

@keyframes ns-skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Update flash animation */
@keyframes ns-mempool-flash {
  0% { background-color: var(--ns-color-primary-subtle); }
  100% { background-color: transparent; }
}

.ns-mempool__stat-value--flash {
  animation: ns-mempool-flash var(--ns-duration-slow, 300ms) var(--ns-easing-easeOut, ease-out);
}

/* Compact mode */
.ns-mempool--compact {
  --ns-mempool-width: 100%;
}

.ns-mempool--compact .ns-mempool__stats {
  grid-template-columns: repeat(4, 1fr);
  gap: var(--ns-space-2, 0.5rem);
  margin-bottom: var(--ns-space-3, 0.75rem);
}

.ns-mempool--compact .ns-mempool__stat-value {
  font-size: var(--ns-font-size-base, 1rem);
}

.ns-mempool--compact .ns-mempool__fees {
  display: none;
}

.ns-mempool--compact .ns-mempool__congestion-bar {
  height: 4px;
  margin-bottom: var(--ns-space-3, 0.75rem);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .ns-mempool,
  .ns-mempool__status,
  .ns-mempool__congestion-fill,
  .ns-mempool__stat-value,
  .ns-mempool__fee-bar,
  .ns-mempool__tooltip {
    transition: none;
  }

  .ns-mempool__status-dot,
  .ns-mempool--loading .ns-mempool__stat-value,
  .ns-mempool--loading .ns-mempool__fee-bar-value,
  .ns-mempool__stat-value--flash {
    animation: none;
  }
}
`;

// Inject styles
const STYLE_ID = 'ns-mempool-styles';

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styles;
  document.head.appendChild(style);
}

export function MempoolVisualization({
  data: initialData,
  pollInterval = 30000,
  apiEndpoint,
  fetchData: customFetch,
  onDataUpdate,
  className = '',
  compact = false
}: MempoolVisualizationProps) {
  const [data, setData] = useState<MempoolData>(initialData ?? DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [updatedFields, setUpdatedFields] = useState<Set<string>>(new Set());
  const prevDataRef = useRef<MempoolData | null>(null);

  // Inject styles on mount
  useEffect(() => {
    ensureStyles();
  }, []);

  // Fetch data function
  const loadData = useCallback(async () => {
    try {
      let newData: MempoolData;

      if (customFetch) {
        newData = await customFetch();
      } else if (apiEndpoint) {
        const res = await fetch(apiEndpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        newData = await res.json();
      } else {
        // Use mock data if no fetch method provided
        newData = {
          txCount: Math.floor(Math.random() * 50000) + 10000,
          sizeVMB: Math.floor(Math.random() * 300) + 20,
          feeRates: {
            low: Math.floor(Math.random() * 10) + 1,
            medium: Math.floor(Math.random() * 30) + 10,
            high: Math.floor(Math.random() * 100) + 30
          },
          lastUpdated: Date.now()
        };
      }

      // Track which fields changed
      if (prevDataRef.current) {
        const changed = new Set<string>();
        if (prevDataRef.current.txCount !== newData.txCount) changed.add('txCount');
        if (prevDataRef.current.sizeVMB !== newData.sizeVMB) changed.add('sizeVMB');
        if (changed.size > 0) {
          setUpdatedFields(changed);
          setTimeout(() => setUpdatedFields(new Set()), 300);
        }
      }

      prevDataRef.current = newData;
      setData(newData);
      setIsLoading(false);
      onDataUpdate?.(newData);
    } catch (err) {
      console.warn('Mempool data fetch failed:', err);
      setIsLoading(false);
    }
  }, [apiEndpoint, customFetch, onDataUpdate]);

  // Initial fetch and polling
  useEffect(() => {
    if (!initialData) {
      loadData();
    }

    if (pollInterval > 0) {
      const interval = setInterval(loadData, pollInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [loadData, pollInterval, initialData]);

  const congestionLevel = useMemo(() => getCongestionLevel(data), [data]);
  const congestionLabel = useMemo(() => getCongestionLabel(congestionLevel), [congestionLevel]);

  // Calculate fill percentage (max 300 vMB = 100%)
  const fillPercent = useMemo(() => {
    const maxSize = 300; // vMB for "full" visualization
    return Math.min(100, (data.sizeVMB / maxSize) * 100);
  }, [data.sizeVMB]);

  const containerClass = [
    'ns-mempool',
    'ns',
    'ns-theme',
    isLoading && 'ns-mempool--loading',
    compact && 'ns-mempool--compact',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass} role="region" aria-label="Mempool status">
      {/* Header */}
      <div className="ns-mempool__header">
        <span className="ns-mempool__title">Mempool</span>
        <div
          className={`ns-mempool__status ns-mempool__status--${congestionLevel}`}
          role="status"
          aria-live="polite"
        >
          <span className="ns-mempool__status-dot" aria-hidden="true" />
          <span>{congestionLabel}</span>
        </div>
      </div>

      {/* Congestion bar */}
      <div
        className="ns-mempool__congestion-bar"
        role="progressbar"
        aria-valuenow={Math.round(fillPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Mempool congestion: ${Math.round(fillPercent)}%`}
      >
        <div
          className={`ns-mempool__congestion-fill ns-mempool__congestion-fill--${congestionLevel}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {/* Stats */}
      <div className="ns-mempool__stats">
        <div className="ns-mempool__stat">
          <span
            className={`ns-mempool__stat-value ${updatedFields.has('txCount') ? 'ns-mempool__stat-value--flash' : ''}`}
          >
            {formatNumber(data.txCount)}
          </span>
          <span className="ns-mempool__stat-label">Unconfirmed txs</span>
        </div>
        <div className="ns-mempool__stat">
          <span
            className={`ns-mempool__stat-value ${updatedFields.has('sizeVMB') ? 'ns-mempool__stat-value--flash' : ''}`}
          >
            {formatSize(data.sizeVMB)}
          </span>
          <span className="ns-mempool__stat-label">Mempool size</span>
        </div>
      </div>

      {/* Fee rates */}
      {!compact && (
        <div className="ns-mempool__fees">
          <span className="ns-mempool__fees-title">Fee estimates</span>
          <div className="ns-mempool__fee-bars">
            <div className="ns-mempool__fee-bar ns-mempool__fee-bar--low">
              <span className="ns-mempool__fee-bar-label">Low</span>
              <span className="ns-mempool__fee-bar-value">{formatFee(data.feeRates.low)}</span>
              <span className="ns-mempool__tooltip">Low priority (1+ hour)</span>
            </div>
            <div className="ns-mempool__fee-bar ns-mempool__fee-bar--medium">
              <span className="ns-mempool__fee-bar-label">Med</span>
              <span className="ns-mempool__fee-bar-value">{formatFee(data.feeRates.medium)}</span>
              <span className="ns-mempool__tooltip">Medium priority (~30 min)</span>
            </div>
            <div className="ns-mempool__fee-bar ns-mempool__fee-bar--high">
              <span className="ns-mempool__fee-bar-label">High</span>
              <span className="ns-mempool__fee-bar-value">{formatFee(data.feeRates.high)}</span>
              <span className="ns-mempool__tooltip">High priority (~10 min)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
