import '../styles/find-friend.css';

import type { Meta, StoryObj } from '@storybook/react';

import { FindFriendCard } from './FindFriendCard';

const meta = {
  title: 'Complex/FindFriendCard',
  component: FindFriendCard,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' }
  }
} satisfies Meta<typeof FindFriendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClick: () => console.log('Find friend clicked')
  }
};

export const WithoutCallback: Story = {
  args: {
    onClick: undefined
  }
};

export const InContainer: Story = {
  render: (args) => (
    <div style={{ width: '600px', padding: '1rem', background: 'var(--color-canvas-default)' }}>
      <FindFriendCard {...args} />
    </div>
  ),
  args: {
    onClick: () => console.log('Find friend clicked')
  }
};

export const MultipleCards: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '600px' }}>
      <FindFriendCard onClick={() => console.log('Card 1 clicked')} />
      <FindFriendCard onClick={() => console.log('Card 2 clicked')} />
      <FindFriendCard onClick={() => console.log('Card 3 clicked')} />
    </div>
  ),
  args: {}
};
