import { useCallback, useEffect, useRef, useState } from 'react';

const ONBOARDING_KEY = 'nostrstack.onboarding.v1';
const ONBOARDING_RESTART_EVENT = 'nostrstack:restart-onboarding-tour';

export type OnboardingStep = {
  id: string;
  target?: string;
  title: string;
  content: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
};

export const TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to NostrStack',
    content: "Your gateway to the decentralized social web. Let's take a quick tour.",
    placement: 'bottom'
  },
  {
    id: 'sidebar',
    target: '.sidebar-nav',
    title: 'Navigation',
    content: 'Access your Feed, Profile, Messages, and Settings here.',
    placement: 'right'
  },
  {
    id: 'wallet',
    target: '.wallet-actions',
    title: 'Lightning Wallet',
    content: 'Connect a wallet to Zap users and pay for services.',
    placement: 'right'
  },
  {
    id: 'feed',
    target: '.feed-stream',
    title: 'Live Feed',
    content: 'Stream events from your connected relays in real-time.',
    placement: 'left'
  },
  {
    id: 'telemetry',
    target: '.telemetry-sidebar',
    title: 'Telemetry',
    content: 'Monitor connection status and network traffic.',
    placement: 'left'
  }
];

export function useOnboarding() {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
    return;
  }, []);

  const finish = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const next = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  const back = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  const skip = () => finish();

  const reset = useCallback(() => {
    hasInitialized.current = false;
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.removeItem(ONBOARDING_KEY);
  }, []);

  useEffect(() => {
    const onRestartTour = () => {
      reset();
    };

    window.addEventListener(ONBOARDING_RESTART_EVENT, onRestartTour);
    return () => {
      window.removeEventListener(ONBOARDING_RESTART_EVENT, onRestartTour);
    };
  }, [reset]);

  return {
    isActive,
    step: TOUR_STEPS[currentStepIndex],
    isLastStep: currentStepIndex === TOUR_STEPS.length - 1,
    hasPreviousStep: currentStepIndex > 0,
    next,
    back,
    skip,
    reset
  };
}
