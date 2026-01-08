import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { HelpModal } from './HelpModal';

const meta = {
  title: 'UI/HelpModal',
  component: HelpModal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HelpModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function OpenHelpModalWrapper() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Show Help Modal</button>
      <HelpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export const Open: Story = {
  render: () => <OpenHelpModalWrapper />,
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
  },
};

/**
 * Accessibility Example: Modal Dialog Best Practices
 * 
 * The HelpModal demonstrates accessible modal patterns:
 * - Focus trap: Tab cycles within modal
 * - Auto-focus: First interactive element receives focus on open
 * - Escape key: Closes modal
 * - Focus restoration: Returns focus to trigger on close
 * - ARIA attributes: role="dialog", aria-modal="true", aria-labelledby
 * 
 * Test keyboard navigation:
 * 1. Click "Show Help Modal" button
 * 2. Press Tab - focus cycles within modal only
 * 3. Press Escape - modal closes and focus returns to button
 */
function AccessibilityDemoWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Show Help Modal</button>
      <HelpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export const AccessibilityDemo: Story = {
  render: () => <AccessibilityDemoWrapper />,
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates accessible modal dialog patterns including focus trap, keyboard navigation, and proper ARIA attributes. Test with keyboard: Tab (focus trap), Escape (close), and verify focus restoration.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'aria-dialog-name', enabled: true },
          { id: 'focus-trap', enabled: true },
        ],
      },
    },
  },
};
