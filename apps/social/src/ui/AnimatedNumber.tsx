import { useEffect, useRef, useState } from 'react';

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
}

/**
 * AnimatedBlockHeight - Special animation for Bitcoin block height
 * Shows a dramatic effect when new blocks are mined
 */
export function AnimatedBlockHeight({ value, className = '' }: AnimatedBlockHeightProps) {
  const [isNewBlock, setIsNewBlock] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value > previousValue.current) {
      setIsNewBlock(true);
      const timeout = setTimeout(() => setIsNewBlock(false), 1500);
      previousValue.current = value;
      return () => clearTimeout(timeout);
    }
    previousValue.current = value;
    return undefined;
  }, [value]);

  return (
    <span className={`animated-block-height ${isNewBlock ? 'is-new-block' : ''} ${className}`}>
      <AnimatedNumber value={value} duration={800} className="animated-block-height__value" />
    </span>
  );
}
