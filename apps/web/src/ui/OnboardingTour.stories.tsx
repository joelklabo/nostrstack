import '../styles/base/tour.css';

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { type OnboardingStep } from '../hooks/useOnboarding';
import { OnboardingTour } from './OnboardingTour';

// Mock the useOnboarding hook for Storybook
const mockSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to NostrStack',
    content: "Your gateway to the decentralized Nostr web. Let's take a quick tour.",
    placement: 'bottom'
  },
  {
    id: 'sidebar',
    target: '.mock-sidebar',
    title: 'Navigation',
    content: 'Access your Feed, Profile, Messages, and Settings here.',
    placement: 'right'
  },
  {
    id: 'wallet',
    target: '.mock-wallet',
    title: 'Lightning Wallet',
    content: 'Connect a wallet to Zap users and pay for services.',
    placement: 'right'
  },
  {
    id: 'feed',
    target: '.mock-feed',
    title: 'Live Feed',
    content: 'Stream events from your connected relays in real-time.',
    placement: 'left'
  }
];

// Interactive wrapper that manages tour state
function InteractiveTour() {
  const [isActive, setIsActive] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const next = () => {
    if (currentStepIndex < mockSteps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      setIsActive(false);
    }
  };

  const back = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  const skip = () => setIsActive(false);

  const reset = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const mockUseOnboarding = {
    isActive,
    step: mockSteps[currentStepIndex],
    isLastStep: currentStepIndex === mockSteps.length - 1,
    hasPreviousStep: currentStepIndex > 0,
    next,
    back,
    skip,
    reset
  };

  // Mock the hook
  const _useOnboarding = () => mockUseOnboarding;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Mock UI elements for tour targets */}
      <div style={{ display: 'flex', height: '100%' }}>
        <div
          className="mock-sidebar"
          style={{
            width: '240px',
            background: 'var(--ns-color-bg-subtle)',
            padding: '1rem',
            borderRight: '1px solid var(--ns-color-border-default)'
          }}
        >
          <h3>Sidebar</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ padding: '0.5rem 0' }}>Feed</li>
            <li style={{ padding: '0.5rem 0' }}>Profile</li>
            <li style={{ padding: '0.5rem 0' }}>Messages</li>
            <li style={{ padding: '0.5rem 0' }}>Settings</li>
          </ul>
        </div>

        <div style={{ flex: 1, padding: '2rem' }}>
          <div
            className="mock-wallet"
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              background: 'var(--ns-color-bg-subtle)',
              borderRadius: '8px',
              border: '1px solid var(--ns-color-border-default)'
            }}
          >
            <h4>Lightning Wallet</h4>
            <button type="button" className="action-btn">
              Connect Wallet
            </button>
          </div>

          <div
            className="mock-feed"
            style={{
              padding: '1rem',
              background: 'var(--ns-color-bg-subtle)',
              borderRadius: '8px',
              border: '1px solid var(--ns-color-border-default)'
            }}
          >
            <h4>Live Feed</h4>
            <div style={{ height: '200px', overflow: 'auto' }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: 'var(--ns-color-bg-default)',
                    borderRadius: '4px'
                  }}
                >
                  Event {i + 1}
                </div>
              ))}
            </div>
          </div>

          {!isActive && (
            <button
              type="button"
              onClick={reset}
              className="action-btn"
              style={{ marginTop: '2rem' }}
            >
              Restart Tour
            </button>
          )}
        </div>
      </div>

      <OnboardingTour />
    </div>
  );
}

const meta = {
  title: 'Complex/OnboardingTour',
  component: OnboardingTour,
  parameters: {
    layout: 'fullscreen'
  },
  tags: ['autodocs']
} satisfies Meta<typeof OnboardingTour>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => <InteractiveTour />,
  args: {}
};

export const WelcomeStep: Story = {
  render: () => {
    const _mockUseOnboarding = () => ({
      isActive: true,
      step: mockSteps[0],
      isLastStep: false,
      hasPreviousStep: false,
      next: () => {},
      back: () => {},
      skip: () => {},
      reset: () => {}
    });

    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <OnboardingTour />
      </div>
    );
  },
  args: {}
};

function WithTargetElementWrapper() {
  const [currentStep, setCurrentStep] = useState(1);

  const _mockUseOnboarding = () => ({
    isActive: true,
    step: mockSteps[currentStep],
    isLastStep: currentStep === mockSteps.length - 1,
    hasPreviousStep: currentStep > 0,
    next: () => setCurrentStep((i) => Math.min(i + 1, mockSteps.length - 1)),
    back: () => setCurrentStep((i) => Math.max(i - 1, 0)),
    skip: () => {},
    reset: () => setCurrentStep(0)
  });
  // Suppress unused variable warning - mock is for demonstration
  void _mockUseOnboarding;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', padding: '2rem' }}>
      <div
        className="mock-sidebar"
        style={{
          width: '240px',
          background: 'var(--ns-color-bg-subtle)',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid var(--ns-color-border-default)'
        }}
      >
        <h3>Sidebar Navigation</h3>
      </div>
      <OnboardingTour />
    </div>
  );
}

export const WithTargetElement: Story = {
  render: () => <WithTargetElementWrapper />,
  args: {}
};
