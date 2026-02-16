import './block-celebration.css';

import { useCallback, useEffect, useRef, useState } from 'react';

// Storage keys for celebration preferences
const CELEBRATION_SOUND_KEY = 'nostrstack.blockCelebration.sound';
const CELEBRATION_ANIMATION_KEY = 'nostrstack.blockCelebration.animation';
const CELEBRATION_STYLE_KEY = 'nostrstack.blockCelebration.style';

export type CelebrationStyle = 'glow-pulse' | 'confetti' | 'none';

export interface BlockCelebrationPreferences {
  soundEnabled: boolean;
  animationEnabled: boolean;
  style: CelebrationStyle;
}

/**
 * Hook to manage block celebration preferences
 */
export function useBlockCelebrationPreferences(): [
  BlockCelebrationPreferences,
  (prefs: Partial<BlockCelebrationPreferences>) => void
] {
  const [prefs, setPrefs] = useState<BlockCelebrationPreferences>(() => {
    if (typeof window === 'undefined') {
      return { soundEnabled: false, animationEnabled: true, style: 'glow-pulse' };
    }
    return {
      soundEnabled: window.localStorage.getItem(CELEBRATION_SOUND_KEY) === 'true',
      animationEnabled: window.localStorage.getItem(CELEBRATION_ANIMATION_KEY) !== 'false',
      style:
        (window.localStorage.getItem(CELEBRATION_STYLE_KEY) as CelebrationStyle) || 'glow-pulse'
    };
  });

  const updatePrefs = useCallback((updates: Partial<BlockCelebrationPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CELEBRATION_SOUND_KEY, String(next.soundEnabled));
        window.localStorage.setItem(CELEBRATION_ANIMATION_KEY, String(next.animationEnabled));
        window.localStorage.setItem(CELEBRATION_STYLE_KEY, next.style);
      }
      return next;
    });
  }, []);

  return [prefs, updatePrefs];
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

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  velocity: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
  color: string;
}

const CONFETTI_COLORS = [
  'var(--ns-color-bitcoin-default)',
  'var(--ns-color-warning-default)',
  '#FFD700', // Gold
  '#FFA500', // Orange
  '#FF8C00' // Dark Orange
];

/**
 * Generate confetti particles for burst animation
 */
function generateConfetti(count: number): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: 50 + (Math.random() - 0.5) * 20, // Center with slight randomness
      y: 50 + (Math.random() - 0.5) * 10,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
      velocity: 2 + Math.random() * 3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 20,
      scale: 0.5 + Math.random() * 0.5,
      opacity: 1,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    });
  }
  return particles;
}

interface BlockCelebrationProps {
  isActive: boolean;
  style: CelebrationStyle;
  soundEnabled: boolean;
  onComplete?: () => void;
}

/**
 * BlockCelebration - Visual celebration effect when a new block is mined
 *
 * Two styles available:
 * 1. "glow-pulse" - Radial glow with pulsing rings emanating outward
 * 2. "confetti" - Bitcoin-orange confetti burst with particles
 */
export function BlockCelebration({
  isActive,
  style,
  soundEnabled,
  onComplete
}: BlockCelebrationProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const animationRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Play celebration sound
  useEffect(() => {
    if (!isActive || !soundEnabled || prefersReducedMotion) return;

    // Create and play a subtle "ding" sound using Web Audio API
    if (typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Create a pleasant "ding" tone
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Cleanup
        setTimeout(() => {
          oscillator.disconnect();
          gainNode.disconnect();
          audioContext.close();
        }, 600);
      } catch {
        // Audio API not available or blocked
      }
    }
  }, [isActive, soundEnabled, prefersReducedMotion]);

  // Handle confetti animation
  useEffect(() => {
    if (!isActive || style !== 'confetti' || prefersReducedMotion) {
      setConfetti([]);
      return;
    }

    // Generate initial confetti
    const particles = generateConfetti(24);
    setConfetti(particles);

    const startTime = performance.now();
    const duration = 2000; // 2 seconds

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setConfetti((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: particle.x + Math.cos(particle.angle) * particle.velocity * 0.5,
          y: particle.y + Math.sin(particle.angle) * particle.velocity * 0.5 + progress * 2,
          rotation: particle.rotation + particle.rotationSpeed,
          opacity: Math.max(0, 1 - progress * 1.2),
          velocity: particle.velocity * 0.98 // Slow down over time
        }))
      );

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setConfetti([]);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, style, prefersReducedMotion, onComplete]);

  // Handle glow-pulse completion
  useEffect(() => {
    if (!isActive || style !== 'glow-pulse' || prefersReducedMotion) return;

    const timeout = setTimeout(() => {
      onComplete?.();
    }, 2500);

    return () => clearTimeout(timeout);
  }, [isActive, style, prefersReducedMotion, onComplete]);

  // Don't render if reduced motion is preferred or animation is inactive
  if (prefersReducedMotion || !isActive || style === 'none') {
    return null;
  }

  if (style === 'confetti') {
    return (
      <div
        ref={containerRef}
        className="block-celebration block-celebration--confetti"
        aria-hidden="true"
      >
        {confetti.map((particle) => (
          <div
            key={particle.id}
            className="block-confetti-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
              opacity: particle.opacity,
              backgroundColor: particle.color
            }}
          />
        ))}
        <div className="block-celebration-shimmer" />
      </div>
    );
  }

  // Default: glow-pulse style
  return (
    <div
      ref={containerRef}
      className="block-celebration block-celebration--glow-pulse"
      aria-hidden="true"
    >
      <div className="block-glow-ring block-glow-ring--1" />
      <div className="block-glow-ring block-glow-ring--2" />
      <div className="block-glow-ring block-glow-ring--3" />
      <div className="block-glow-core" />
    </div>
  );
}

/**
 * Wrapper component to add celebration to AnimatedBlockHeight
 */
interface CelebratingBlockHeightProps {
  value: number;
  className?: string;
  preferences: BlockCelebrationPreferences;
}

export function CelebratingBlockHeight({
  value,
  className = '',
  preferences
}: CelebratingBlockHeightProps) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const previousValue = useRef(value);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (value > previousValue.current) {
      // New block detected!
      if (preferences.animationEnabled && !prefersReducedMotion) {
        setIsCelebrating(true);
        setIsFlipping(true);

        // Animate the number flip
        const flipDuration = 600;
        const startTime = performance.now();
        const startValue = previousValue.current;

        const animateFlip = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / flipDuration, 1);

          // Easing function (ease-out-cubic)
          const eased = 1 - Math.pow(1 - progress, 3);
          const currentValue = Math.round(startValue + (value - startValue) * eased);
          setDisplayValue(currentValue);

          if (progress < 1) {
            requestAnimationFrame(animateFlip);
          } else {
            setDisplayValue(value);
            setIsFlipping(false);
          }
        };

        requestAnimationFrame(animateFlip);
      } else {
        setDisplayValue(value);
      }
      previousValue.current = value;
    } else if (value !== previousValue.current) {
      // Value changed but not increased (e.g., reorg or initial load)
      setDisplayValue(value);
      previousValue.current = value;
    }
  }, [value, preferences.animationEnabled, prefersReducedMotion]);

  const handleCelebrationComplete = useCallback(() => {
    setIsCelebrating(false);
  }, []);

  return (
    <span
      className={`celebrating-block-height ${isFlipping ? 'is-flipping' : ''} ${isCelebrating ? 'is-celebrating' : ''} ${className}`}
    >
      <span className="celebrating-block-height__value">
        {displayValue.toLocaleString('en-US')}
      </span>
      {preferences.animationEnabled && (
        <BlockCelebration
          isActive={isCelebrating}
          style={preferences.style}
          soundEnabled={preferences.soundEnabled}
          onComplete={handleCelebrationComplete}
        />
      )}
    </span>
  );
}
