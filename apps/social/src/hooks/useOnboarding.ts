import { useEffect, useState } from 'react';

const ONBOARDING_KEY = 'nostrstack.onboarding.v1';

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
    content: 'Your gateway to the decentralized social web. Let\'s take a quick tour.',
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
    return;
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

  const finish = () => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const reset = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.removeItem(ONBOARDING_KEY);
  }

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
