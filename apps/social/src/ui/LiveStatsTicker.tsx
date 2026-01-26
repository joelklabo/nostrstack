import './live-stats-ticker.css';

import { useEffect, useMemo, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================

export interface NetworkStats {
  blockHeight: number;
  hashrate?: number; // in EH/s
  difficulty?: number;
  lastBlockTime?: number; // Unix timestamp
}

interface LiveStatsTickerProps {
  stats: NetworkStats;
  className?: string;
  compact?: boolean;
  showLabels?: boolean;
}

interface OdometerDigitProps {
  digit: string;
  delay?: number;
}

interface AnimatedStatProps {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  format?: 'number' | 'hashrate' | 'difficulty' | 'time';
  isPulsing?: boolean;
  className?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1000) {
    return `${(hashrate / 1000).toFixed(2)} ZH/s`;
  }
  return `${hashrate.toFixed(2)} EH/s`;
}

function formatDifficulty(difficulty: number): string {
  if (difficulty >= 1e12) {
    return `${(difficulty / 1e12).toFixed(2)}T`;
  }
  if (difficulty >= 1e9) {
    return `${(difficulty / 1e9).toFixed(2)}B`;
  }
  if (difficulty >= 1e6) {
    return `${(difficulty / 1e6).toFixed(2)}M`;
  }
  return difficulty.toLocaleString();
}

function formatTimeSince(timestamp: number): { display: string; isRecent: boolean } {
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, now - timestamp);

  const isRecent = delta < 60; // Less than 1 minute

  if (delta < 60) {
    return { display: `${delta}s`, isRecent };
  }
  if (delta < 3600) {
    const mins = Math.floor(delta / 60);
    const secs = delta % 60;
    return { display: `${mins}m ${secs}s`, isRecent };
  }
  if (delta < 86400) {
    const hours = Math.floor(delta / 3600);
    const mins = Math.floor((delta % 3600) / 60);
    return { display: `${hours}h ${mins}m`, isRecent: false };
  }
  const days = Math.floor(delta / 86400);
  return { display: `${days}d`, isRecent: false };
}

// ============================================
// ODOMETER DIGIT COMPONENT
// ============================================

/**
 * Individual digit with flip/roll animation
 * Creates an odometer-style effect when digit changes
 */
function OdometerDigit({ digit, delay = 0 }: OdometerDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [prevDigit, setPrevDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (digit !== currentDigit) {
      setPrevDigit(currentDigit);
      setIsFlipping(true);

      const timeout = setTimeout(() => {
        setCurrentDigit(digit);
        setTimeout(() => setIsFlipping(false), 300);
      }, delay);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [digit, currentDigit, delay]);

  const isNumber = /^\d$/.test(digit);

  return (
    <span
      className={`odometer-digit ${isFlipping ? 'is-flipping' : ''} ${isNumber ? 'is-number' : 'is-separator'}`}
      data-digit={currentDigit}
      data-prev={prevDigit}
    >
      <span className="odometer-digit__track">
        {isFlipping && <span className="odometer-digit__prev">{prevDigit}</span>}
        <span className="odometer-digit__current">{currentDigit}</span>
      </span>
    </span>
  );
}

// ============================================
// ODOMETER DISPLAY COMPONENT
// ============================================

interface OdometerDisplayProps {
  value: string;
  className?: string;
}

/**
 * Full odometer display with multiple digits
 * Each digit animates independently with staggered timing
 */
function OdometerDisplay({ value, className = '' }: OdometerDisplayProps) {
  const digits = value.split('');

  return (
    <span className={`odometer-display ${className}`}>
      {digits.map((digit, index) => (
        <OdometerDigit key={`${index}-${digits.length}`} digit={digit} delay={index * 30} />
      ))}
    </span>
  );
}

// ============================================
// ANIMATED STAT COMPONENT
// ============================================

function AnimatedStat({
  value,
  label,
  icon,
  format = 'number',
  isPulsing,
  className = ''
}: AnimatedStatProps) {
  const formattedValue = useMemo(() => {
    if (typeof value === 'string') return value;

    switch (format) {
      case 'hashrate':
        return formatHashrate(value);
      case 'difficulty':
        return formatDifficulty(value);
      case 'number':
      default:
        return value.toLocaleString();
    }
  }, [value, format]);

  return (
    <div className={`live-stat ${isPulsing ? 'is-pulsing' : ''} ${className}`}>
      <div className="live-stat__label">
        {icon && <span className="live-stat__icon">{icon}</span>}
        {label}
      </div>
      <div className="live-stat__value">
        <OdometerDisplay value={formattedValue} />
      </div>
    </div>
  );
}

// ============================================
// TIME SINCE BLOCK COMPONENT
// ============================================

interface TimeSinceBlockProps {
  timestamp?: number;
  className?: string;
}

function TimeSinceBlock({ timestamp, className = '' }: TimeSinceBlockProps) {
  const [timeData, setTimeData] = useState<{ display: string; isRecent: boolean }>({
    display: '--',
    isRecent: false
  });

  useEffect(() => {
    if (!timestamp) {
      setTimeData({ display: '--', isRecent: false });
      return;
    }

    const updateTime = () => {
      setTimeData(formatTimeSince(timestamp));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div
      className={`live-stat live-stat--time ${timeData.isRecent ? 'is-recent' : ''} ${className}`}
    >
      <div className="live-stat__label">
        <span className="live-stat__icon">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        Last block
      </div>
      <div className="live-stat__value live-stat__value--time">
        <OdometerDisplay value={timeData.display} />
        {timeData.isRecent && <span className="live-stat__badge">Just now</span>}
      </div>
    </div>
  );
}

// ============================================
// MAIN LIVE STATS TICKER COMPONENT
// ============================================

export function LiveStatsTicker({
  stats,
  className = '',
  compact = false,
  showLabels = true
}: LiveStatsTickerProps) {
  const [pulsingStats, setPulsingStats] = useState<Set<string>>(new Set());
  const prevStats = useRef(stats);

  // Detect changes and trigger pulse animations
  useEffect(() => {
    const changed: string[] = [];

    if (stats.blockHeight !== prevStats.current.blockHeight) {
      changed.push('blockHeight');
    }
    if (stats.hashrate !== prevStats.current.hashrate) {
      changed.push('hashrate');
    }
    if (stats.difficulty !== prevStats.current.difficulty) {
      changed.push('difficulty');
    }
    if (stats.lastBlockTime !== prevStats.current.lastBlockTime) {
      changed.push('lastBlockTime');
    }

    if (changed.length > 0) {
      setPulsingStats(new Set(changed));
      const timeout = setTimeout(() => setPulsingStats(new Set()), 1000);
      prevStats.current = stats;
      return () => clearTimeout(timeout);
    }

    prevStats.current = stats;
    return undefined;
  }, [stats]);

  return (
    <div
      className={`live-stats-ticker ${compact ? 'live-stats-ticker--compact' : ''} ${className}`}
    >
      <div className="live-stats-ticker__header">
        <span className="live-stats-ticker__title">
          <span className="live-stats-ticker__live-dot" />
          Network Stats
        </span>
      </div>

      <div className="live-stats-ticker__grid">
        {/* Block Height - Primary stat */}
        <AnimatedStat
          value={stats.blockHeight}
          label={showLabels ? 'Block height' : ''}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z" />
            </svg>
          }
          isPulsing={pulsingStats.has('blockHeight')}
          className="live-stat--block-height"
        />

        {/* Hashrate */}
        {stats.hashrate !== undefined && (
          <AnimatedStat
            value={stats.hashrate}
            label={showLabels ? 'Hashrate' : ''}
            format="hashrate"
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            }
            isPulsing={pulsingStats.has('hashrate')}
            className="live-stat--hashrate"
          />
        )}

        {/* Difficulty */}
        {stats.difficulty !== undefined && (
          <AnimatedStat
            value={stats.difficulty}
            label={showLabels ? 'Difficulty' : ''}
            format="difficulty"
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            }
            isPulsing={pulsingStats.has('difficulty')}
            className="live-stat--difficulty"
          />
        )}

        {/* Time since last block */}
        <TimeSinceBlock
          timestamp={stats.lastBlockTime}
          className={pulsingStats.has('lastBlockTime') ? 'is-pulsing' : ''}
        />
      </div>
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export { AnimatedStat, OdometerDisplay, TimeSinceBlock };
