import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BlockCelebration,
  type BlockCelebrationPreferences,
  useBlockCelebrationPreferences
} from './BlockCelebration';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  locale?: string;
  className?: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
}

/**
 * AnimatedNumber - Smoothly animates between number values
 * Uses CSS transitions and requestAnimationFrame for smooth updates
 * Bitcoin orange pulse effect on value changes
 */
export function AnimatedNumber({
  value,
  duration = 500,
  locale = 'en-US',
  className = '',
  suffix = '',
  prefix = '',
  decimals = 0,
  onAnimationStart,
  onAnimationEnd
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === previousValue.current) return;

    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    setIsAnimating(true);
    onAnimationStart?.();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        onAnimationEnd?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    previousValue.current = value;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, onAnimationStart, onAnimationEnd]);

  const formattedValue =
    decimals > 0
      ? displayValue.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        })
      : Math.round(displayValue).toLocaleString(locale);

  return (
    <span
      className={`animated-number ${isAnimating ? 'is-animating' : ''} ${className}`}
      data-animating={isAnimating}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

interface AnimatedSatsProps {
  value: number;
  className?: string;
  showUnit?: boolean;
  unitClassName?: string;
}

/**
 * AnimatedSats - Bitcoin-specific animated number with sats unit
 * Includes Bitcoin orange glow effect on value changes
 */
export function AnimatedSats({
  value,
  className = '',
  showUnit = true,
  unitClassName = ''
}: AnimatedSatsProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value !== previousValue.current) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 600);
      previousValue.current = value;
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [value]);

  return (
    <span className={`animated-sats ${isPulsing ? 'is-pulsing' : ''} ${className}`}>
      <AnimatedNumber value={value} duration={400} className="animated-sats__value" />
      {showUnit && <span className={`animated-sats__unit ${unitClassName}`}>sats</span>}
    </span>
  );
}

interface AnimatedBlockHeightProps {
  value: number;
  className?: string;
  /** Enable the new celebration effect (glow-pulse or confetti) */
  enableCelebration?: boolean;
  /** Override celebration preferences (uses stored preferences by default) */
  celebrationPreferences?: BlockCelebrationPreferences;
}

/**
 * Check if user prefers reduced motion
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
 * AnimatedBlockHeight - Special animation for Bitcoin block height
 * Shows a dramatic effect when new blocks are mined
 *
 * Now supports two celebration modes:
 * - Legacy: Simple "NEW" badge with glow (default, backward compatible)
 * - Celebration: Enhanced glow-pulse or confetti effect (opt-in via enableCelebration)
 */
export function AnimatedBlockHeight({
  value,
  className = '',
  enableCelebration = false,
  celebrationPreferences: overridePrefs
}: AnimatedBlockHeightProps) {
  const [isNewBlock, setIsNewBlock] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const previousValue = useRef(value);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [storedPrefs] = useBlockCelebrationPreferences();
  const prefs = overridePrefs ?? storedPrefs;

  const handleCelebrationComplete = useCallback(() => {
    setIsCelebrating(false);
  }, []);

  useEffect(() => {
    if (value > previousValue.current) {
      // New block detected
      setIsNewBlock(true);

      // Trigger celebration if enabled and animations are on
      if (enableCelebration && prefs.animationEnabled && !prefersReducedMotion) {
        setIsCelebrating(true);
      }

      const timeout = setTimeout(() => setIsNewBlock(false), 1500);
      previousValue.current = value;
      return () => clearTimeout(timeout);
    }
    previousValue.current = value;
    return undefined;
  }, [value, enableCelebration, prefs.animationEnabled, prefersReducedMotion]);

  // Determine which animation mode to use
  const showLegacyAnimation = isNewBlock && !enableCelebration;
  const showCelebration = isCelebrating && enableCelebration && prefs.animationEnabled;

  return (
    <span
      className={`animated-block-height ${showLegacyAnimation ? 'is-new-block' : ''} ${showCelebration ? 'is-celebrating' : ''} ${className}`}
    >
      <AnimatedNumber value={value} duration={800} className="animated-block-height__value" />
      {showCelebration && (
        <BlockCelebration
          isActive={isCelebrating}
          style={prefs.style}
          soundEnabled={prefs.soundEnabled}
          onComplete={handleCelebrationComplete}
        />
      )}
    </span>
  );
}

// Re-export celebration components for convenience
export type { BlockCelebrationPreferences, CelebrationStyle } from './BlockCelebration';
export { CelebratingBlockHeight } from './BlockCelebration';
