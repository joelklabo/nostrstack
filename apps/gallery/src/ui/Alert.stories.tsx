import type { Meta, StoryObj } from '@storybook/react';

import { Alert } from './Alert';

const meta = {
  title: 'UI/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'success', 'warning', 'danger'],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    tone: 'info',
    title: 'Information',
    children: 'This is an informational alert.',
  },
};

export const Success: Story = {
  args: {
    tone: 'success',
    title: 'Success',
    children: 'Operation completed successfully.',
  },
};

export const Warning: Story = {
  args: {
    tone: 'warning',
    title: 'Warning',
    children: 'Please be careful with this action.',
  },
};

export const Danger: Story = {
  args: {
    tone: 'danger',
    title: 'Error',
    children: 'Something went wrong.',
  },
};

export const WithRetry: Story = {
  args: {
    tone: 'warning',
    title: 'Connection Lost',
    children: 'Unable to connect to relay.',
    onRetry: () => alert('Retrying...'),
    retryLabel: 'Reconnect',
  },
};

/**
 * Accessibility Example: ARIA Live Regions
 * 
 * The Alert component uses appropriate ARIA live regions:
 * - role="alert" for danger/error alerts (assertive)
 * - role="status" for info/success (polite)
 * - Screen readers announce message immediately
 * - Focus remains where user was working
 * 
 * Different tones map to appropriate urgency:
 * - Danger: aria-live="assertive" (interrupts)
 * - Warning: aria-live="assertive" (interrupts)
 * - Info/Success: aria-live="polite" (waits for pause)
 */
export const AccessibilityDemo: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
      <Alert tone="info" title="Info">
        This uses role="status" and aria-live="polite"
      </Alert>
      <Alert tone="success" title="Success">
        Also uses aria-live="polite" (non-interrupting)
      </Alert>
      <Alert tone="danger" title="Error">
        This uses role="alert" and aria-live="assertive" (interrupting)
      </Alert>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates proper ARIA live region usage for alerts. Different tones use appropriate assertiveness levels for screen readers. Error and warning alerts interrupt immediately (assertive), while info and success wait for a pause (polite).',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'aria-roles', enabled: true },
          { id: 'aria-valid-attr-value', enabled: true },
        ],
      },
    },
  },
};
