import { useCallback, useEffect, useRef, useState } from 'react';

interface UseImmersiveScrollOptions {
  /** Scroll threshold in pixels before triggering immersive mode */
  threshold?: number;
  /** Minimum scroll delta to trigger state change */
  minDelta?: number;
  /** Element selector to attach scroll listener (defaults to window) */
  scrollContainer?: string;
  /** Disable immersive mode */
  disabled?: boolean;
}

/**
 * Hook to track scroll direction and enable immersive mode.
 * Returns true when user is scrolling down (past threshold), enabling UI elements to hide.
 */
export function useImmersiveScroll(options: UseImmersiveScrollOptions = {}) {
  const { threshold = 100, minDelta = 10, scrollContainer, disabled = false } = options;

  const [isImmersive, setIsImmersive] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;

    ticking.current = true;
    requestAnimationFrame(() => {
      const container = scrollContainer ? document.querySelector(scrollContainer) : window;

      const currentScrollY =
        container instanceof Window ? window.scrollY : (container as HTMLElement)?.scrollTop ?? 0;

      const delta = currentScrollY - lastScrollY.current;
      const pastThreshold = currentScrollY > threshold;

      // Only change state if delta is significant
      if (Math.abs(delta) > minDelta) {
        if (delta > 0 && pastThreshold) {
          // Scrolling down past threshold -> go immersive
          setIsImmersive(true);
        } else if (delta < 0) {
          // Scrolling up -> exit immersive
          setIsImmersive(false);
        }
      }

      // At top of page, always exit immersive
      if (currentScrollY < threshold / 2) {
        setIsImmersive(false);
      }

      lastScrollY.current = currentScrollY;
      ticking.current = false;
    });
  }, [threshold, minDelta, scrollContainer]);

  useEffect(() => {
    if (disabled) {
      setIsImmersive(false);
      return;
    }

    const container = scrollContainer ? document.querySelector(scrollContainer) : window;

    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, scrollContainer, disabled]);

  // Apply class to body for CSS targeting
  useEffect(() => {
    if (disabled) return;

    if (isImmersive) {
      document.body.classList.add('is-immersive');
    } else {
      document.body.classList.remove('is-immersive');
    }

    return () => {
      document.body.classList.remove('is-immersive');
    };
  }, [isImmersive, disabled]);

  return { isImmersive, setIsImmersive };
}
