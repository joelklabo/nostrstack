import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { Event, EventTemplate } from 'nostr-tools';
import React from 'react';

import { AuthContextType, AuthProvider } from './auth';
import { NostrstackProvider } from './context';
import { ZapButton } from './zap-button';

// Mock event to zap
const mockEvent: Event = {
  id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [['lud16', 'satoshi@nostrstack.com']],
  content: 'GM! ☕',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const mockEventNoLightningAddress: Event = {
  ...mockEvent,
  tags: []
};

const mockAuthContextLoggedIn = {
  pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234',
  signEvent: async (template: EventTemplate) => ({
    ...template,
    id: 'signed-event-id',
    sig: 'signed-event-sig',
    pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234'
  })
};

const mockAuthContextLoggedOut = {
  pubkey: null,
  signEvent: async () => {
    throw new Error('Not logged in');
  }
};

const mockConfig = {
  apiBase: 'https://api.nostrstack.com',
  baseUrl: 'https://nostrstack.com',
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  enableRegtestPay: false
};

const mockConfigWithRegtest = {
  ...mockConfig,
  enableRegtestPay: true
};

type StoryArgs = React.ComponentProps<typeof ZapButton> & {
  loggedIn?: boolean;
  enableRegtestPay?: boolean;
};

const meta = {
  title: 'Payment/ZapButton',
  component: ZapButton,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const args = context.args as StoryArgs;
      const authContext =
        args.loggedIn !== false ? mockAuthContextLoggedIn : mockAuthContextLoggedOut;
      const config = args.enableRegtestPay ? mockConfigWithRegtest : mockConfig;
      return (
        <AuthProvider value={authContext as unknown as AuthContextType}>
          <NostrstackProvider {...config}>
            <Story />
          </NostrstackProvider>
        </AuthProvider>
      );
    }
  ],
  argTypes: {
    event: { control: false },
    amountSats: { control: 'number' },
    message: { control: 'text' },
    onZapSuccess: { action: 'zap-success' },
    loggedIn: { control: 'boolean', description: 'Mock auth state' },
    enableRegtestPay: { control: 'boolean' }
  }
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const CustomAmount: Story = {
  args: {
    event: mockEvent,
    amountSats: 1000,
    message: 'Great post! 🔥',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const LargeAmount: Story = {
  args: {
    event: mockEvent,
    amountSats: 100000,
    message: 'Amazing work!',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const CustomMessage: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: '⚡ Love this! Keep it up! 🚀',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const NoLightningAddress: Story = {
  args: {
    event: mockEventNoLightningAddress,
    amountSats: 21,
    message: 'Zap!',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const NotLoggedIn: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    onZapSuccess: () => {},
    loggedIn: false
  }
};

export const WithRegtestPay: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    onZapSuccess: () => {},
    loggedIn: true,
    enableRegtestPay: true
  }
};

export const WithCustomRelays: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    relays: ['wss://relay.nostr.band', 'wss://relay.snort.social'],
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const WithCustomClass: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    className: 'custom-zap-btn',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const WithAuthorLightningAddressOverride: Story = {
  args: {
    event: mockEventNoLightningAddress,
    amountSats: 21,
    message: 'Zap!',
    authorLightningAddress: 'override@lightning.address',
    onZapSuccess: () => {},
    loggedIn: true
  }
};

export const WithSuccessCallback: Story = {
  args: {
    event: mockEvent,
    amountSats: 21,
    message: 'Zap!',
    onZapSuccess: fn(() => console.log('Zap succeeded!')),
    loggedIn: true
  }
};
