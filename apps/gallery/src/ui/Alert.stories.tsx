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
