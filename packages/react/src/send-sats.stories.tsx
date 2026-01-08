import type { Meta, StoryObj } from '@storybook/react';
import type { EventTemplate } from 'nostr-tools';
import type React from 'react';

import type { AuthContextType} from './auth';
import { AuthProvider } from './auth';
import { NostrstackProvider } from './context';
import { SendSats } from './send-sats';

const mockPubkey = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const mockLightningAddress = 'satoshi@nostrstack.com';

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

type StoryArgs = React.ComponentProps<typeof SendSats> & {
  loggedIn?: boolean;
  enableRegtestPay?: boolean;
};

const meta = {
  title: 'Payment/SendSats',
  component: SendSats,
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
    pubkey: { control: 'text' },
    lightningAddress: { control: 'text' },
    defaultAmountSats: { control: 'number' },
    presetAmountsSats: { control: 'object' },
    notePlaceholder: { control: 'text' },
    loggedIn: { control: 'boolean', description: 'Mock auth state' },
    enableRegtestPay: { control: 'boolean' }
  }
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const SmallAmount: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 21,
    presetAmountsSats: [1, 21, 100],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const LargeAmount: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 100000,
    presetAmountsSats: [10000, 50000, 100000],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const CustomPresets: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 69,
    presetAmountsSats: [69, 420, 1337],
    notePlaceholder: 'GM!',
    loggedIn: true
  }
};

export const NoLightningAddress: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: null,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const NotLoggedIn: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Add a note…',
    loggedIn: false
  }
};

export const WithRegtestPay: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Add a note…',
    loggedIn: true,
    enableRegtestPay: true
  }
};

export const WithCustomRelays: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    relays: ['wss://relay.nostr.band', 'wss://relay.snort.social'],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const CustomPlaceholder: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Thanks for the great content! 🚀',
    loggedIn: true
  }
};

export const InvalidPubkey: Story = {
  args: {
    pubkey: 'invalid-pubkey',
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [21, 100, 500],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};

export const EmptyPresets: Story = {
  args: {
    pubkey: mockPubkey,
    lightningAddress: mockLightningAddress,
    defaultAmountSats: 500,
    presetAmountsSats: [],
    notePlaceholder: 'Add a note…',
    loggedIn: true
  }
};
