import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Error variants for Bitcoin telemetry states
 */
export type TelemetryErrorVariant =
  | 'network-unreachable'
  | 'api-down'
  | 'timeout'
  | 'no-data'
  | 'websocket-disconnected'
  | 'rate-limited'
  | 'auth-required';

/**
 * Determines if an error is user-fixable or a system issue
 */
export type ErrorCategory = 'user-fixable' | 'system';

export interface TelemetryErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  /** The type of error to display */
  variant: TelemetryErrorVariant;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for secondary action (e.g., Check Settings) */
  onSecondaryAction?: () => void;
  /** Whether a retry is in progress */
  isRetrying?: boolean;
  /** Show compact version */
  compact?: boolean;
  /** Additional details to show (e.g., error code, timestamp) */
  details?: string;
}

type ErrorConfig = {
  title: string;
  message: string;
  icon: ReactNode;
  primaryAction: string;
  secondaryAction?: string;
  category: ErrorCategory;
  hint?: string;
};

const errorConfigs: Record<TelemetryErrorVariant, ErrorConfig> = {
  'network-unreachable': {
    title: 'No Internet Connection',
    message:
      "We can't reach the Bitcoin network right now. Check your internet connection and try again.",
    icon: <NetworkOfflineIcon />,
    primaryAction: 'Try Again',
    secondaryAction: 'Check Connection',
    category: 'user-fixable',
    hint: 'Make sure you have an active internet connection'
  },
  'api-down': {
    title: 'Service Temporarily Unavailable',
    message:
      "Our servers are having a moment. We're working on it and things should be back to normal soon.",
    icon: <ServerDownIcon />,
    primaryAction: 'Retry',
    category: 'system',
    hint: 'This usually resolves within a few minutes'
  },
  timeout: {
    title: 'Request Timed Out',
    message:
      'The request took longer than expected. This might be due to slow network conditions or high server load.',
    icon: <TimeoutIcon />,
    primaryAction: 'Try Again',
    category: 'system',
    hint: 'Try again in a moment'
  },
  'no-data': {
    title: 'No Data Available Yet',
    message:
      "We're still gathering blockchain data. This can take a moment when starting up or after a sync.",
    icon: <EmptyDataIcon />,
    primaryAction: 'Refresh',
    category: 'system',
    hint: 'Data will appear once the node syncs'
  },
  'websocket-disconnected': {
    title: 'Live Updates Paused',
    message:
      'The real-time connection was interrupted. Data shown may be outdated until reconnected.',
    icon: <DisconnectedIcon />,
    primaryAction: 'Reconnect',
    category: 'system',
    hint: 'Attempting to reconnect automatically...'
  },
  'rate-limited': {
    title: 'Too Many Requests',
    message: "You've made too many requests. Please wait a moment before trying again.",
    icon: <RateLimitIcon />,
    primaryAction: 'Wait & Retry',
    category: 'user-fixable',
    hint: 'Requests will be available again shortly'
  },
  'auth-required': {
    title: 'Authentication Required',
    message: 'You need to be signed in to access this telemetry data.',
    icon: <AuthIcon />,
    primaryAction: 'Sign In',
    secondaryAction: 'Learn More',
    category: 'user-fixable'
  }
};

function NetworkOfflineIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-danger-subtle)" />
      <path
        d="M24 14C18.48 14 14 18.48 14 24C14 29.52 18.48 34 24 34C29.52 34 34 29.52 34 24C34 18.48 29.52 14 24 14ZM24 32C19.59 32 16 28.41 16 24C16 19.59 19.59 16 24 16C28.41 16 32 19.59 32 24C32 28.41 28.41 32 24 32Z"
        fill="var(--ns-color-danger-default)"
      />
      <path
        d="M17 17L31 31M31 17L17 31"
        stroke="var(--ns-color-danger-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* WiFi symbol with slash */}
      <path
        d="M24 28C25.1 28 26 27.1 26 26C26 24.9 25.1 24 24 24C22.9 24 22 24.9 22 26C22 27.1 22.9 28 24 28Z"
        fill="var(--ns-color-danger-default)"
      />
      <path
        d="M20.5 22.5C21.6 21.6 22.7 21 24 21C25.3 21 26.4 21.6 27.5 22.5"
        stroke="var(--ns-color-danger-default)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 20C19.8 18.5 21.8 17.5 24 17.5C26.2 17.5 28.2 18.5 30 20"
        stroke="var(--ns-color-danger-default)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function ServerDownIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-warning-subtle)" />
      {/* Server stack */}
      <rect
        x="16"
        y="14"
        width="16"
        height="6"
        rx="1"
        fill="var(--ns-color-warning-muted)"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="1.5"
      />
      <rect
        x="16"
        y="21"
        width="16"
        height="6"
        rx="1"
        fill="var(--ns-color-warning-muted)"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="1.5"
      />
      <rect
        x="16"
        y="28"
        width="16"
        height="6"
        rx="1"
        fill="var(--ns-color-warning-muted)"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="1.5"
      />
      {/* Status lights */}
      <circle cx="19" cy="17" r="1" fill="var(--ns-color-danger-default)" />
      <circle cx="19" cy="24" r="1" fill="var(--ns-color-danger-default)" />
      <circle cx="19" cy="31" r="1" fill="var(--ns-color-warning-default)" />
    </svg>
  );
}

function TimeoutIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-warning-subtle)" />
      {/* Clock face */}
      <circle
        cx="24"
        cy="24"
        r="10"
        fill="var(--ns-color-surface-default)"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="2"
      />
      {/* Clock hands */}
      <path
        d="M24 18V24L28 26"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Exclamation */}
      <circle cx="33" cy="15" r="4" fill="var(--ns-color-danger-default)" />
      <path d="M33 13V15M33 17V17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyDataIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-info-subtle)" />
      {/* Empty box/container */}
      <path
        d="M16 20L24 15L32 20V28L24 33L16 28V20Z"
        fill="var(--ns-color-surface-default)"
        stroke="var(--ns-color-info-default)"
        strokeWidth="1.5"
      />
      <path d="M16 20L24 25L32 20" stroke="var(--ns-color-info-default)" strokeWidth="1.5" />
      <path d="M24 25V33" stroke="var(--ns-color-info-default)" strokeWidth="1.5" />
      {/* Dashed lines suggesting missing data */}
      <path
        d="M20 22L20 26"
        stroke="var(--ns-color-info-muted)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <path
        d="M28 22L28 26"
        stroke="var(--ns-color-info-muted)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function DisconnectedIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-warning-subtle)" />
      {/* Broken link/chain */}
      <path
        d="M20 24H16C14.9 24 14 23.1 14 22V22C14 20.9 14.9 20 16 20H20"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M28 24H32C33.1 24 34 24.9 34 26V26C34 27.1 33.1 28 32 28H28"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Lightning bolt showing disconnection */}
      <path
        d="M23 18L21 23H25L23 28"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Break indicator */}
      <path
        d="M22 22L26 26"
        stroke="var(--ns-color-danger-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RateLimitIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-warning-subtle)" />
      {/* Speedometer/gauge */}
      <path
        d="M24 34C18.48 34 14 29.52 14 24C14 18.48 18.48 14 24 14C29.52 14 34 18.48 34 24"
        stroke="var(--ns-color-warning-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Needle pointing to max */}
      <path
        d="M24 24L30 18"
        stroke="var(--ns-color-danger-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="2" fill="var(--ns-color-warning-default)" />
      {/* Speed marks */}
      <path d="M17 20L18 21" stroke="var(--ns-color-warning-muted)" strokeWidth="1.5" />
      <path d="M17 28L18 27" stroke="var(--ns-color-warning-muted)" strokeWidth="1.5" />
      <path d="M24 17V19" stroke="var(--ns-color-warning-muted)" strokeWidth="1.5" />
    </svg>
  );
}

function AuthIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="var(--ns-color-primary-subtle)" />
      {/* Lock */}
      <rect
        x="18"
        y="22"
        width="12"
        height="10"
        rx="2"
        fill="var(--ns-color-primary-muted)"
        stroke="var(--ns-color-primary-default)"
        strokeWidth="1.5"
      />
      {/* Lock shackle */}
      <path
        d="M20 22V19C20 16.79 21.79 15 24 15C26.21 15 28 16.79 28 19V22"
        stroke="var(--ns-color-primary-default)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Keyhole */}
      <circle cx="24" cy="26" r="1.5" fill="var(--ns-color-primary-default)" />
      <path d="M24 27V29" stroke="var(--ns-color-primary-default)" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * TelemetryErrorState - A comprehensive error state component for Bitcoin telemetry
 *
 * Provides friendly, non-technical error messages with clear calls-to-action.
 * Distinguishes between user-fixable issues and system problems.
 */
export function TelemetryErrorState({
  variant,
  title,
  message,
  onRetry,
  onSecondaryAction,
  isRetrying = false,
  compact = false,
  details,
  className = '',
  ...props
}: TelemetryErrorStateProps) {
  const config = errorConfigs[variant];
  const displayTitle = title ?? config.title;
  const displayMessage = message ?? config.message;
  const isUserFixable = config.category === 'user-fixable';

  return (
    <div
      className={`ns-telemetry-error ${compact ? 'ns-telemetry-error--compact' : ''} ${className}`}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {!compact && <div className="ns-telemetry-error__icon">{config.icon}</div>}

      <div className="ns-telemetry-error__content">
        <h3 className="ns-telemetry-error__title">{displayTitle}</h3>
        <p className="ns-telemetry-error__message">{displayMessage}</p>

        {config.hint && <p className="ns-telemetry-error__hint">{config.hint}</p>}

        {details && <p className="ns-telemetry-error__details">{details}</p>}

        <div className="ns-telemetry-error__category">
          {isUserFixable ? (
            <span className="ns-telemetry-error__badge ns-telemetry-error__badge--user">
              You can fix this
            </span>
          ) : (
            <span className="ns-telemetry-error__badge ns-telemetry-error__badge--system">
              Working on it
            </span>
          )}
        </div>
      </div>

      <div className="ns-telemetry-error__actions">
        {onRetry && (
          <button
            type="button"
            className="ns-btn ns-btn--primary ns-btn--sm"
            onClick={onRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
          >
            {isRetrying ? (
              <>
                <span className="ns-spinner ns-spinner--sm" aria-hidden="true" />
                Retrying...
              </>
            ) : (
              config.primaryAction
            )}
          </button>
        )}

        {config.secondaryAction && onSecondaryAction && (
          <button
            type="button"
            className="ns-btn ns-btn--ghost ns-btn--sm"
            onClick={onSecondaryAction}
          >
            {config.secondaryAction}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline variant for use within cards or smaller spaces
 */
export function TelemetryErrorInline({
  variant,
  onRetry,
  isRetrying,
  className = ''
}: Pick<TelemetryErrorStateProps, 'variant' | 'onRetry' | 'isRetrying' | 'className'>) {
  const config = errorConfigs[variant];

  return (
    <div className={`ns-telemetry-error-inline ${className}`} role="alert" aria-live="polite">
      <span className="ns-telemetry-error-inline__icon" aria-hidden="true">
        {variant === 'network-unreachable' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        )}
        {variant === 'api-down' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z" />
          </svg>
        )}
        {variant === 'timeout' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
          </svg>
        )}
        {variant === 'no-data' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4z" />
          </svg>
        )}
        {variant === 'websocket-disconnected' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.31 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zm-1 4h-2.19l2 2H16zM2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-1.59 1.21-2.9 2.76-3.07L8.73 11H8v2h2.73L13 15.27V17h1.73l4.01 4L20 19.74 3.27 3 2 4.27z" />
          </svg>
        )}
        {variant === 'rate-limited' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z" />
          </svg>
        )}
        {variant === 'auth-required' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        )}
      </span>
      <span className="ns-telemetry-error-inline__text">{config.title}</span>
      {onRetry && (
        <button
          type="button"
          className="ns-telemetry-error-inline__retry"
          onClick={onRetry}
          disabled={isRetrying}
          aria-label={config.primaryAction}
        >
          {isRetrying ? (
            <span className="ns-spinner ns-spinner--sm" aria-hidden="true" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Empty state variant specifically for "waiting for data" scenarios
 */
export function TelemetryEmptyState({
  title = 'Waiting for Blockchain Data',
  message = 'The node is syncing and gathering data. Statistics will appear here once available.',
  onRefresh,
  isRefreshing,
  showProgress,
  progress,
  className = ''
}: {
  title?: string;
  message?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showProgress?: boolean;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={`ns-telemetry-empty ${className}`} role="status" aria-live="polite">
      <div className="ns-telemetry-empty__icon" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" fill="var(--ns-color-bg-muted)" />
          {/* Bitcoin symbol */}
          <path
            d="M32 16C23.16 16 16 23.16 16 32s7.16 16 16 16 16-7.16 16-16-7.16-16-16-16zm1.88 21.45V40h-2.22v-2.47c-1.32-.12-2.65-.51-3.57-.99l.57-2.29c1.03.47 2.32.91 3.47.91 1.04 0 1.64-.36 1.64-.99 0-.6-.52-.92-1.87-1.36-1.93-.61-3.35-1.52-3.35-3.36 0-1.61 1.15-2.88 3.11-3.28V24h2.22v2.11c.92.11 1.92.36 2.73.72l-.51 2.22c-.76-.32-1.68-.64-2.67-.64-1.19 0-1.48.49-1.48.87 0 .51.53.8 2.08 1.4 2.24.81 3.16 1.88 3.16 3.48 0 1.64-1.17 2.96-3.32 3.29z"
            fill="var(--ns-color-text-subtle)"
          />
          {/* Animated dots */}
          <circle cx="20" cy="48" r="3" fill="var(--ns-color-primary-muted)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0s"
            />
          </circle>
          <circle cx="32" cy="48" r="3" fill="var(--ns-color-primary-muted)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          <circle cx="44" cy="48" r="3" fill="var(--ns-color-primary-muted)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.5s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
        </svg>
      </div>

      <h3 className="ns-telemetry-empty__title">{title}</h3>
      <p className="ns-telemetry-empty__message">{message}</p>

      {showProgress && typeof progress === 'number' && (
        <div className="ns-telemetry-empty__progress">
          <div className="ns-telemetry-empty__progress-bar">
            <div
              className="ns-telemetry-empty__progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="ns-telemetry-empty__progress-label">{progress.toFixed(1)}% synced</span>
        </div>
      )}

      {onRefresh && (
        <button
          type="button"
          className="ns-btn ns-btn--ghost ns-btn--sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <span className="ns-spinner ns-spinner--sm" aria-hidden="true" />
              Checking...
            </>
          ) : (
            'Check Status'
          )}
        </button>
      )}
    </div>
  );
}
