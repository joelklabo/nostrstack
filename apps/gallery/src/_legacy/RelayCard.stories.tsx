import type { Meta, StoryObj } from '@storybook/react';

import { RelayCard } from './RelayCard';

const meta: Meta<typeof RelayCard> = {
  title: 'RelayCard',
  component: RelayCard,
  args: {
    url: 'wss://relay.damus.io',
    recv: 128,
    recvPerMin: 14,
    last: Date.now() - 1500,
    lastSentAt: Date.now() - 3500,
    latencyMs: 82,
    online: true,
    meta: {
      name: 'Damus Relay',
      software: 'strfry',
      version: '0.10.1',
      description: 'Fast public relay with partial indexing and paid write tier.',
      supportedNips: [1, 9, 11, 15, 50],
      paymentRequired: false,
      authRequired: false
    }
  }
};

export default meta;
type Story = StoryObj<typeof RelayCard>;

export const Online: Story = {};

export const Offline: Story = {
  args: {
    online: false,
    latencyMs: undefined,
    recvPerMin: 0,
    recv: 0,
    meta: { name: 'Down relay', software: 'unknown', supportedNips: [1, 11], paymentRequired: true, authRequired: true }
  }
};

export const Sending: Story = {
  args: {
    sendStatus: 'sending',
    lastSentAt: Date.now() - 800,
    recvPerMin: 3
  }
};

export const Dark: Story = {
  args: {
    theme: 'dark'
  }
};
