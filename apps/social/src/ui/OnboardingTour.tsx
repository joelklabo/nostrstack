import '../styles/base/tour.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useOnboarding } from '../hooks/useOnboarding';

export function OnboardingTour() {
  const { isActive, step, isLastStep, hasPreviousStep, next, back, skip } = useOnboarding();
  const stepTarget = useMemo(() => step.target, [step]);
  const stepPlacement = useMemo(() => step.placement, [step]);
  const [position, setPosition] = useState<React.CSSProperties>({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  });
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  // Focus management
  useEffect(() => {
    if (!isActive) {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
      triggerRef.current = null;
      return;
    }

    // Store trigger element when tour starts
    if (!triggerRef.current) {
      triggerRef.current = document.activeElement as HTMLElement;
    }

    // Focus first button in tour card
    const card = cardRef.current;
    if (!card) return;

    const focusable = card.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusTimeoutRef.current = window.setTimeout(() => focusable.focus(), 100);
    }

    return () => {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [isActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
      if (e.key === 'ArrowRight' && !isLastStep) {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft' && hasPreviousStep) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, next, back, skip, isLastStep, hasPreviousStep]);

  // Scroll into view
  useEffect(() => {
    if (!isActive || !stepTarget) return;
    const el = document.querySelector(stepTarget);
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
  }, [isActive, stepTarget]);

  useEffect(() => {
    if (!isActive) return;

    if (!stepTarget) {
      setPosition({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      });
      setSpotlightStyle(null);
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(stepTarget);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpotlightStyle({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });

        // Calculate card position
        let top = rect.bottom + 12;
        let left = rect.left + rect.width / 2 - 160; // Center horizontally (width 320)
        let transform: string | undefined;

        if (stepPlacement === 'right') {
          top = rect.top;
          left = rect.right + 12;
        } else if (stepPlacement === 'left') {
          top = rect.top;
          left = rect.left - 332; // 320 + 12
        } else if (stepPlacement === 'top') {
          top = rect.top - 12;
          // Ideally we subtract height, but let's just shift up a bit and hope
          transform = 'translateY(-100%)';
        }

        // Boundary checks (simple)
        if (left < 10) left = 10;
        if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;
        if (top < 10) top = 10;
        if (top + 150 > window.innerHeight - 10) {
          top = window.innerHeight - 160;
          if (transform) transform = undefined; // Reset transform if we clamp
        }

        setPosition({ top, left, transform });
      } else {
        // Fallback
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
        setSpotlightStyle(null);
      }
    };

    // Delay update to allow layout to settle
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      cancelAnimationFrame(raf);
    };
  }, [isActive, stepTarget, stepPlacement]);

  if (!isActive) return null;

  return createPortal(
    <>
      <div className="onboarding-overlay" aria-hidden="true" data-testid="onboarding-overlay" />
      {spotlightStyle && (
        <div
          className="onboarding-spotlight"
          style={spotlightStyle}
          aria-hidden="true"
          data-testid="onboarding-spotlight"
        />
      )}
      <button
        type="button"
        className="onboarding-dismiss"
        data-testid="onboarding-dismiss"
        onClick={skip}
        aria-label="Dismiss tour"
        title="Press Escape to dismiss"
      >
        ×
      </button>
      <div
        className="onboarding-card"
        data-testid="onboarding-card"
        style={position}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-desc"
      >
        <div id="tour-title" className="onboarding-title" data-testid="onboarding-title">
          {step.title}
        </div>
        <div id="tour-desc" className="onboarding-content" data-testid="onboarding-content">
          {step.content}
        </div>
        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-btn onboarding-btn-skip"
            data-testid="onboarding-skip-btn"
            onClick={skip}
            aria-label="Skip tour"
          >
            Skip
          </button>
          {hasPreviousStep && (
            <button
              type="button"
              className="onboarding-btn"
              data-testid="onboarding-back-btn"
              onClick={back}
              aria-label="Go to previous step"
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="onboarding-btn onboarding-btn-next"
            data-testid="onboarding-next-btn"
            onClick={next}
            aria-label={isLastStep ? 'Finish tour' : 'Go to next step'}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
