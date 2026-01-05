import type { Meta, StoryObj } from '@storybook/react';
import type { Event } from 'nostr-tools';
import { ReactionButton } from './reaction-button';
import { AuthProvider } from './auth';
import { NostrstackConfigProvider } from './context';

const mockEvent: Event = {
  id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Great post!',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const mockAuthContextLoggedIn = {
  pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234',
  signEvent: async (template) => ({
    ...template,
    id: 'reaction-event-id-' + Date.now(),
    sig: 'signed-reaction-sig',
    pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234'
  }))
};

const mockAuthContextLoggedOut = {
  pubkey: null,
  signEvent: async () => {
    throw new Error('Not logged in');
  })
};

const mockConfig = {
  relays: ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
};

const meta = {
  title: 'Nostr/ReactionButton',
  component: ReactionButton,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const authContext = context.args.loggedIn !== false ? mockAuthContextLoggedIn : mockAuthContextLoggedOut;
      return (
        <AuthProvider value={authContext}>
          <NostrstackConfigProvider value={mockConfig}>
            <Story />
          </NostrstackConfigProvider>
        </AuthProvider>
      );
    }
  ],
  argTypes: {
    event: { control: false },
    relays: { control: 'object' },
    className: { control: 'text' },
    style: { control: 'object' },
    loggedIn: { control: 'boolean', description: 'Mock auth state' }
  }
} satisfies Meta<typeof ReactionButton & { loggedIn?: boolean }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    event: mockEvent,
    loggedIn: true
  }
};

export const NotLoggedIn: Story = {
  args: {
    event: mockEvent,
    loggedIn: false
  }
};

export const WithCustomClass: Story = {
  args: {
    event: mockEvent,
    className: 'custom-reaction-btn',
    loggedIn: true
  }
};

export const WithCustomStyle: Story = {
  args: {
    event: mockEvent,
    style: { fontSize: '1.5rem', padding: '0.75rem 1rem' },
    loggedIn: true
  }
};

export const WithCustomRelays: Story = {
  args: {
    event: mockEvent,
    relays: ['wss://relay.nostr.band', 'wss://relay.snort.social'],
    loggedIn: true
  }
};

export const DifferentEventTypes: Story = {
  render: () => (
    <AuthProvider value={mockAuthContextLoggedIn}>
      <NostrstackConfigProvider value={mockConfig}>
        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <span style={{ marginRight: '0.5rem' }}>Text note:</span>
            <ReactionButton event={{ ...mockEvent, kind: 1 }} />
          </div>
          <div>
            <span style={{ marginRight: '0.5rem' }}>Long-form:</span>
            <ReactionButton event={{ ...mockEvent, kind: 30023 }} />
          </div>
          <div>
            <span style={{ marginRight: '0.5rem' }}>Image:</span>
            <ReactionButton event={{ ...mockEvent, kind: 1, content: 'https://example.com/image.jpg' }} />
          </div>
        </div>
      </NostrstackConfigProvider>
    </AuthProvider>
  ),
  args: {}
};

export const MultipleButtons: Story = {
  render: () => (
    <AuthProvider value={mockAuthContextLoggedIn}>
      <NostrstackConfigProvider value={mockConfig}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <ReactionButton event={mockEvent} />
          <ReactionButton event={{ ...mockEvent, id: 'event2' }} />
          <ReactionButton event={{ ...mockEvent, id: 'event3' }} />
        </div>
      </NostrstackConfigProvider>
    </AuthProvider>
  ),
  args: {}
};
