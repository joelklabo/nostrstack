import type { Meta, StoryObj } from '@storybook/react';

import { CopyButton } from './CopyButton';

const meta = {
  title: 'UI/CopyButton',
  component: CopyButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'npub1examplekeyhere...',
  },
};

export const CustomLabel: Story = {
  args: {
    value: 'some-value-to-copy',
    label: 'COPY TEXT',
  },
};
