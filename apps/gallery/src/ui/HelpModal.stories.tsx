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

export const Open: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Show Help Modal</button>
        <HelpModal open={open} onClose={() => setOpen(false)} />
      </div>
    );
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
  },
};
