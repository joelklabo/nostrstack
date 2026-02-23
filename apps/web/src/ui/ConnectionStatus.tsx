import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Connection Status State Machine
 * ================================
 *
 * States and Transitions:
 *
 *            ┌───────────────────────────────────────────────────────────────┐
 *            │                                                               │
 *            │                    ┌─────────────┐                            │
 *            │     ┌──────────────│  CONNECTED  │◄─────────────┐             │
 *            │     │              └─────────────┘              │             │
 *            │     │                    │                      │             │
 *            │     │ ws close/          │ ws close             │ ws open     │
 *            │     │ browser offline    │ (retryable)          │             │
 *            │     ▼                    ▼                      │             │
 *            │ ┌─────────┐       ┌─────────────┐        ┌──────┴─────┐       │
 *            │ │ OFFLINE │◄──────│ RECONNECTING│◄───────│ CONNECTING │       │
 *            │ └─────────┘       └─────────────┘        └────────────┘       │
 *            │     │                    │                      ▲             │
 *            │     │                    │ max retries          │             │
 *            │     │ retry clicked      │ exceeded             │ init        │
 *            │     │ / browser online   │                      │             │
 *            │     └────────────────────┴──────────────────────┘             │
 *            │                                                               │
 *            │  ┌─────────┐                                                  │
 *            └──│  ERROR  │◄── auth error / fatal error                      │
 *               └─────────┘                                                  │
 *                    │                                                       │
 *                    │ retry clicked                                         │
 *                    └───────────────────────────────────────────────────────┘
 *
 * Network Types:
 * - mainnet:  Green glow + warning badge (real money)
 * - testnet:  Amber/yellow indicator
 * - mutinynet: Amber/yellow indicator (testnet variant)
 * - signet:   Amber/yellow indicator (testnet variant)
 * - regtest:  Teal/primary indicator (local dev)
 */

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export type NetworkType = 'mainnet' | 'testnet' | 'mutinynet' | 'signet' | 'regtest' | 'unknown';

export interface ConnectionStatusProps {
  /** Current connection state */
  state: ConnectionState;
  /** Bitcoin network type */
  network: NetworkType;
  /** Last successful sync timestamp (Unix ms) */
  lastSyncAt?: number | null;
  /** Current reconnection attempt number */
  reconnectAttempt?: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Error message when in error state */
  errorMessage?: string | null;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Show compact version */
  compact?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function formatTimeSince(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const delta = Math.floor((now - timestamp) / 1000);

  if (delta < 5) return 'Just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function getNetworkLabel(network: NetworkType): string {
  const labels: Record<NetworkType, string> = {
    mainnet: 'Mainnet',
    testnet: 'Testnet',
    mutinynet: 'Mutinynet',
    signet: 'Signet',
    regtest: 'Regtest',
    unknown: 'Unknown'
  };
  return labels[network];
}

function getStateLabel(state: ConnectionState, attempt?: number, maxAttempts?: number): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return attempt != null && maxAttempts != null
        ? `Reconnecting (${attempt}/${maxAttempts})`
        : 'Reconnecting';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

function getStateAriaLabel(state: ConnectionState, network: NetworkType): string {
  return `Bitcoin telemetry ${state} on ${getNetworkLabel(network)} network`;
}

// ============================================================================
// Custom Hook for time since update
// ============================================================================

function useTimeSince(timestamp: number | null | undefined) {
  const [timeSince, setTimeSince] = useState<string>(() => formatTimeSince(timestamp));

  useEffect(() => {
    if (!timestamp) {
      setTimeSince('Never');
      return;
    }

    const update = () => setTimeSince(formatTimeSince(timestamp));
    update();

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return timeSince;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusDot({ state }: { state: ConnectionState }) {
  return <span className={`ns-conn-dot ns-conn-dot--${state}`} aria-hidden="true" />;
}

function NetworkBadge({ network }: { network: NetworkType }) {
  const isMainnet = network === 'mainnet';

  return (
    <span
      className={`ns-conn-network ns-conn-network--${network}`}
      role="status"
      aria-label={`Network: ${getNetworkLabel(network)}`}
    >
      {isMainnet && (
        <svg
          className="ns-conn-network-icon"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      )}
      {getNetworkLabel(network)}
    </span>
  );
}

function RetryButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="ns-conn-retry"
      onClick={onClick}
      disabled={disabled}
      aria-label="Retry connection"
    >
      <svg
        className="ns-conn-retry-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Retry
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConnectionStatus({
  state,
  network,
  lastSyncAt,
  reconnectAttempt = 0,
  maxReconnectAttempts = 8,
  errorMessage,
  onRetry,
  className = '',
  compact = false
}: ConnectionStatusProps) {
  const timeSince = useTimeSince(lastSyncAt);
  const stateLabel = getStateLabel(state, reconnectAttempt, maxReconnectAttempts);
  const ariaLabel = getStateAriaLabel(state, network);

  const showRetry = state === 'offline' || state === 'error';
  const showError = state === 'error' && errorMessage;
  const showOfflineStatusNote = state === 'offline' && Boolean(errorMessage);
  const isRecent = lastSyncAt && Date.now() - lastSyncAt < 5000;

  if (compact) {
    return (
      <div
        className={`ns-conn ns-conn--compact ${className}`}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
      >
        <StatusDot state={state} />
        <NetworkBadge network={network} />
      </div>
    );
  }

  return (
    <div
      className={`telemetry-status-row ns-conn ns-conn--${state} ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* Header Row: Status + Network */}
      <div className="ns-conn-header">
        <div className="telemetry-status ns-conn-status" data-status={state}>
          <StatusDot state={state} />
          <span className="ns-conn-label">{stateLabel}</span>
        </div>
        <NetworkBadge network={network} />
      </div>

      {/* Sync Time Row */}
      <div className="ns-conn-sync">
        <span className="ns-conn-sync-label">Last sync:</span>
        <span
          className={`telemetry-status-time ns-conn-sync-time ${isRecent ? 'ns-conn-sync-time--recent' : ''}`}
        >
          {timeSince}
        </span>
      </div>

      {showOfflineStatusNote && (
        <div className="telemetry-status-note">
          <span className="telemetry-status-stale">Data may be outdated</span>
          <span className="telemetry-status-note-text">Offline reason: {errorMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {showError && (
        <div className="ns-conn-error" role="alert">
          <svg
            className="ns-conn-error-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span className="ns-conn-error-text">{errorMessage}</span>
        </div>
      )}

      {/* Retry Button */}
      {showRetry && <RetryButton onClick={onRetry} />}
    </div>
  );
}

// ============================================================================
// Hook for managing connection state machine
// ============================================================================

export interface UseConnectionStatusOptions {
  /** Initial state */
  initialState?: ConnectionState;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnect base delay in ms */
  reconnectBaseDelay?: number;
  /** Reconnect max delay in ms */
  reconnectMaxDelay?: number;
  /** Callback when state changes */
  onStateChange?: (state: ConnectionState) => void;
}

export interface ConnectionStatusManager {
  state: ConnectionState;
  attempt: number;
  error: string | null;
  connect: () => void;
  disconnect: (reason?: string) => void;
  setConnected: () => void;
  setError: (message: string) => void;
  retry: () => void;
}

export function useConnectionStatus(
  options: UseConnectionStatusOptions = {}
): ConnectionStatusManager {
  const {
    initialState = 'connecting',
    maxReconnectAttempts = 8,
    reconnectBaseDelay = 1000,
    reconnectMaxDelay = 30000,
    onStateChange
  } = options;

  const [state, setState] = useState<ConnectionState>(initialState);
  const [attempt, setAttempt] = useState(0);
  const [error, setErrorState] = useState<string | null>(null);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const computeBackoff = useCallback(
    (attemptNum: number) => {
      const base = reconnectBaseDelay * Math.pow(2, attemptNum);
      const capped = Math.min(reconnectMaxDelay, base);
      // Add jitter (+-20%)
      const jitter = capped * 0.2 * (Math.random() * 2 - 1);
      return Math.max(0, Math.round(capped + jitter));
    },
    [reconnectBaseDelay, reconnectMaxDelay]
  );

  const updateState = useCallback(
    (newState: ConnectionState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const connect = useCallback(() => {
    clearRetryTimeout();
    setAttempt(0);
    setErrorState(null);
    updateState('connecting');
  }, [clearRetryTimeout, updateState]);

  const setConnected = useCallback(() => {
    clearRetryTimeout();
    setAttempt(0);
    setErrorState(null);
    updateState('connected');
  }, [clearRetryTimeout, updateState]);

  const disconnect = useCallback(
    (reason?: string) => {
      clearRetryTimeout();

      if (attempt >= maxReconnectAttempts) {
        setErrorState(reason ?? 'Max reconnection attempts exceeded');
        updateState('offline');
        return;
      }

      const nextAttempt = attempt + 1;
      setAttempt(nextAttempt);
      updateState('reconnecting');

      const delay = computeBackoff(nextAttempt - 1);
      retryTimeoutRef.current = setTimeout(() => {
        // This would trigger actual reconnection logic
        // For now, we just stay in reconnecting state
      }, delay);
    },
    [attempt, clearRetryTimeout, computeBackoff, maxReconnectAttempts, updateState]
  );

  const setError = useCallback(
    (message: string) => {
      clearRetryTimeout();
      setErrorState(message);
      updateState('error');
    },
    [clearRetryTimeout, updateState]
  );

  const retry = useCallback(() => {
    clearRetryTimeout();
    setAttempt(0);
    setErrorState(null);
    updateState('connecting');
  }, [clearRetryTimeout, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearRetryTimeout();
  }, [clearRetryTimeout]);

  return useMemo(
    () => ({
      state,
      attempt,
      error,
      connect,
      disconnect,
      setConnected,
      setError,
      retry
    }),
    [state, attempt, error, connect, disconnect, setConnected, setError, retry]
  );
}
