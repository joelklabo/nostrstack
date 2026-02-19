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
  const containerRef = useRef<HTMLElement | Window | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollY =
      container instanceof Window ? window.scrollY : (container as HTMLElement).scrollTop;
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
  }, [minDelta, threshold]);

  const resolveScrollContainer = useCallback((): HTMLElement | Window => {
    const configuredTarget = scrollContainer
      ? document.querySelector<HTMLElement>(scrollContainer)
      : null;
    return configuredTarget ?? window;
  }, [scrollContainer]);

  const ensureScrollBinding = useCallback(() => {
    const nextContainer = resolveScrollContainer();

    if (containerRef.current === nextContainer) {
      return;
    }

    if (containerRef.current) {
      containerRef.current.removeEventListener('scroll', handleScroll);
      if (animationFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    containerRef.current = nextContainer;
    lastScrollY.current =
      containerRef.current instanceof Window ? window.scrollY : containerRef.current.scrollTop;
    containerRef.current.addEventListener('scroll', handleScroll, { passive: true });
  }, [handleScroll, resolveScrollContainer]);

  useEffect(() => {
    if (disabled) {
      setIsImmersive(false);
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
        containerRef.current = null;
      }
      if (animationFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    ensureScrollBinding();
    const mutationObserver = new MutationObserver(() => {
      if (typeof window === 'undefined' || animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        ensureScrollBinding();
      });
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    return () => {
      mutationObserver.disconnect();
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
        containerRef.current = null;
      }
      if (animationFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [disabled, ensureScrollBinding, handleScroll]);

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
