import './BlockNotification.css';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * BlockNotification - Real-time Bitcoin block arrival notification
 *
 * Displays an attention-grabbing but not annoying notification when new blocks arrive.
 * Features a "heartbeat" pulse effect that fades over time, showing the Bitcoin
 * network's vital signs.
 */

export interface BlockData {
  height: number;
  time: number;
  txCount?: number;
  size?: number;
  hash?: string;
}

interface BlockNotificationProps {
  /** Current block data */
  block: BlockData | null;
  /** Time since last block in seconds */
  timeSinceLastBlock?: number;
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Whether to auto-dismiss after animation completes */
  autoDismiss?: boolean;
  /** Auto-dismiss delay in ms (default: 8000) */
  autoDismissDelay?: number;
  /** Whether sound is enabled for new blocks */
  soundEnabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Format block size in human-readable format
 */
function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '--';
  const mb = bytes / 1_000_000;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1_000;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Format time since last block
 */
function formatTimeSince(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Calculate pulse intensity based on time since block
 * Fresh blocks pulse more intensely, fading over ~10 minutes
 */
function calculatePulseIntensity(timeSinceBlock: number): number {
  // Intensity ranges from 1.0 (fresh) to 0.1 (10+ minutes old)
  const maxAge = 600; // 10 minutes
  const intensity = Math.max(0.1, 1 - timeSinceBlock / maxAge);
  return intensity;
}

/**
 * Hook to check if user prefers reduced motion
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to track time since block was received
 */
function useTimeSinceBlock(blockTime?: number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!blockTime) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const now = Math.floor(Date.now() / 1000);
      setElapsed(Math.max(0, now - blockTime));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [blockTime]);

  return elapsed;
}

export function BlockNotification({
  block,
  timeSinceLastBlock,
  onDismiss,
  autoDismiss = true,
  autoDismissDelay = 8000,
  soundEnabled = false,
  className = ''
}: BlockNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(1);
  const previousBlockRef = useRef<number | null>(null);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const timeSinceBlock = useTimeSinceBlock(block?.time);

  // Track new blocks and trigger notification
  useEffect(() => {
    if (!block?.height) return;

    // Check if this is a new block
    if (previousBlockRef.current !== null && block.height > previousBlockRef.current) {
      setIsNew(true);
      setIsVisible(true);
      setPulseIntensity(1);

      // Play notification sound if enabled
      if (
        soundEnabled &&
        !prefersReducedMotion &&
        typeof window !== 'undefined' &&
        window.AudioContext
      ) {
        try {
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          // Create a pleasant "block found" tone - two quick notes
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);

          // Second note
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.12); // E5
          oscillator2.type = 'sine';
          gainNode2.gain.setValueAtTime(0.08, audioContext.currentTime + 0.12);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
          oscillator2.start(audioContext.currentTime + 0.12);
          oscillator2.stop(audioContext.currentTime + 0.35);

          setTimeout(() => {
            oscillator.disconnect();
            gainNode.disconnect();
            oscillator2.disconnect();
            gainNode2.disconnect();
            audioContext.close();
          }, 500);
        } catch {
          // Audio API not available
        }
      }

      // Clear "new" state after animation
      const newTimeout = setTimeout(() => setIsNew(false), 2500);

      // Auto-dismiss
      if (autoDismiss) {
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
        dismissTimeoutRef.current = setTimeout(() => {
          onDismiss?.();
        }, autoDismissDelay);
      }

      return () => {
        clearTimeout(newTimeout);
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
      };
    } else if (previousBlockRef.current === null) {
      // First load - show without "new" animation
      setIsVisible(true);
    }

    previousBlockRef.current = block.height;
    return undefined;
  }, [block?.height, soundEnabled, prefersReducedMotion, autoDismiss, autoDismissDelay, onDismiss]);

  // Update pulse intensity based on time since block
  useEffect(() => {
    if (!block?.time) return;
    const intensity = calculatePulseIntensity(timeSinceBlock);
    setPulseIntensity(intensity);
  }, [block?.time, timeSinceBlock]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    onDismiss?.();
  }, [onDismiss]);

  if (!block || !isVisible) return null;

  const pulseSpeed = prefersReducedMotion ? 0 : Math.max(1.5, 4 - pulseIntensity * 2.5);

  return (
    <div
      className={`block-notification ${isNew ? 'is-new' : ''} ${className}`}
      style={
        {
          '--pulse-intensity': pulseIntensity,
          '--pulse-speed': `${pulseSpeed}s`
        } as React.CSSProperties
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`New Bitcoin block ${block.height.toLocaleString()} found`}
    >
      {/* Heartbeat pulse rings */}
      {!prefersReducedMotion && (
        <div className="block-notification__pulse" aria-hidden="true">
          <div className="block-notification__pulse-ring block-notification__pulse-ring--1" />
          <div className="block-notification__pulse-ring block-notification__pulse-ring--2" />
          <div className="block-notification__pulse-ring block-notification__pulse-ring--3" />
        </div>
      )}

      {/* Bitcoin icon with heartbeat */}
      <div className="block-notification__icon" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="block-notification__bitcoin-icon"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-1.67v-1.85c-.99-.09-1.99-.38-2.68-.74l.43-1.72c.77.35 1.74.68 2.6.68.78 0 1.23-.27 1.23-.74 0-.45-.39-.69-1.4-1.02-1.45-.46-2.51-1.14-2.51-2.52 0-1.21.86-2.16 2.33-2.46V8h1.67v1.58c.69.08 1.44.27 2.05.54l-.38 1.67c-.57-.24-1.26-.48-2-.48-.89 0-1.11.37-1.11.65 0 .38.4.6 1.56 1.05 1.68.61 2.37 1.41 2.37 2.61 0 1.23-.88 2.22-2.49 2.47z" />
        </svg>
      </div>

      {/* Content */}
      <div className="block-notification__content">
        <div className="block-notification__header">
          <span className="block-notification__label">
            {isNew ? 'New Block Found' : 'Latest Block'}
          </span>
          {isNew && <span className="block-notification__badge">NEW</span>}
        </div>

        <div className="block-notification__height">
          <span className="block-notification__height-value">#{block.height.toLocaleString()}</span>
        </div>

        <div className="block-notification__stats">
          <div className="block-notification__stat">
            <span className="block-notification__stat-label">Time</span>
            <span className="block-notification__stat-value">
              {formatTimeSince(timeSinceLastBlock ?? timeSinceBlock)}
            </span>
          </div>
          {block.txCount !== undefined && (
            <div className="block-notification__stat">
              <span className="block-notification__stat-label">Txs</span>
              <span className="block-notification__stat-value">
                {block.txCount.toLocaleString()}
              </span>
            </div>
          )}
          {block.size !== undefined && (
            <div className="block-notification__stat">
              <span className="block-notification__stat-label">Size</span>
              <span className="block-notification__stat-value">{formatSize(block.size)}</span>
            </div>
          )}
        </div>

        {/* Hash preview */}
        {block.hash && (
          <div className="block-notification__hash">
            <code>
              {block.hash.slice(0, 8)}...{block.hash.slice(-8)}
            </code>
          </div>
        )}
      </div>

      {/* Heartbeat indicator */}
      <div className="block-notification__heartbeat" aria-hidden="true">
        <svg
          viewBox="0 0 32 12"
          className="block-notification__heartbeat-line"
          preserveAspectRatio="none"
        >
          <path
            d="M0,6 L8,6 L10,2 L12,10 L14,4 L16,8 L18,6 L32,6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        className="block-notification__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss block notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Compact inline version for sidebar display
 */
export interface BlockNotificationInlineProps {
  block: BlockData | null;
  className?: string;
}

export function BlockNotificationInline({ block, className = '' }: BlockNotificationInlineProps) {
  const [isNew, setIsNew] = useState(false);
  const previousBlockRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const timeSinceBlock = useTimeSinceBlock(block?.time);
  const pulseIntensity = calculatePulseIntensity(timeSinceBlock);

  useEffect(() => {
    if (!block?.height) return;

    if (previousBlockRef.current !== null && block.height > previousBlockRef.current) {
      setIsNew(true);
      const timeout = setTimeout(() => setIsNew(false), 2500);
      return () => clearTimeout(timeout);
    }

    previousBlockRef.current = block.height;
    return undefined;
  }, [block?.height]);

  if (!block) return null;

  return (
    <div
      className={`block-notification-inline ${isNew ? 'is-new' : ''} ${className}`}
      style={
        {
          '--pulse-intensity': pulseIntensity
        } as React.CSSProperties
      }
      role="status"
      aria-live="polite"
    >
      <div className="block-notification-inline__icon" aria-hidden="true">
        {!prefersReducedMotion && <span className="block-notification-inline__pulse" />}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-1.67v-1.85c-.99-.09-1.99-.38-2.68-.74l.43-1.72c.77.35 1.74.68 2.6.68.78 0 1.23-.27 1.23-.74 0-.45-.39-.69-1.4-1.02-1.45-.46-2.51-1.14-2.51-2.52 0-1.21.86-2.16 2.33-2.46V8h1.67v1.58c.69.08 1.44.27 2.05.54l-.38 1.67c-.57-.24-1.26-.48-2-.48-.89 0-1.11.37-1.11.65 0 .38.4.6 1.56 1.05 1.68.61 2.37 1.41 2.37 2.61 0 1.23-.88 2.22-2.49 2.47z" />
        </svg>
      </div>
      <div className="block-notification-inline__content">
        <span className="block-notification-inline__height">#{block.height.toLocaleString()}</span>
        <span className="block-notification-inline__time">{formatTimeSince(timeSinceBlock)}</span>
      </div>
      {isNew && <span className="block-notification-inline__badge">NEW</span>}
    </div>
  );
}
