import type { Meta, StoryObj } from '@storybook/react';
import type { Event, EventTemplate } from 'nostr-tools';
import type React from 'react';

import type { AuthContextType } from './auth';
import { AuthProvider } from './auth';
import { NostrstackProvider } from './context';
import { PostEditor } from './post-editor';

const mockEvent: Event = {
  id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [
    ['e', 'rootevent123456', '', 'root'],
    ['p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef']
  ],
  content: 'This is the parent note content.',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const mockAuthContextLoggedIn = {
  pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234',
  mode: 'extension',
  error: null,
  signEvent: async (template: EventTemplate) => ({
    ...template,
    id: 'signed-event-id-' + Date.now(),
    sig: 'signed-event-sig',
    pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234'
  })
};

const mockAuthContextLoggedOut = {
  pubkey: null,
  mode: 'none',
  error: null,
  signEvent: async () => {
    throw new Error('Not authenticated');
  }
};

const mockAuthContextError = {
  pubkey: null,
  mode: 'extension',
  error: 'Extension not found or permission denied.',
  signEvent: async () => {
    throw new Error('Not authenticated');
  }
};

const mockConfig = {
  relays: ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
};

type StoryArgs = React.ComponentProps<typeof PostEditor> & {
  loggedIn?: boolean;
  authError?: boolean;
};

const meta = {
  title: 'Nostr/PostEditor',
  component: PostEditor,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      let authContext = mockAuthContextLoggedIn as unknown as AuthContextType;
      const args = context.args as StoryArgs;
      if (args.loggedIn === false) {
        authContext = mockAuthContextLoggedOut as unknown as AuthContextType;
      } else if (args.authError) {
        authContext = mockAuthContextError as unknown as AuthContextType;
      }

      return (
        <AuthProvider value={authContext}>
          <NostrstackProvider {...mockConfig}>
            <div style={{ width: '600px', maxWidth: '90vw' }}>
              <Story />
            </div>
          </NostrstackProvider>
        </AuthProvider>
      );
    }
  ],
  argTypes: {
    parentEvent: { control: false },
    onSuccess: { action: 'success' },
    onCancel: { action: 'cancel' },
    placeholder: { control: 'text' },
    autoFocus: { control: 'boolean' },
    loggedIn: { control: 'boolean', description: 'Mock auth state' },
    authError: { control: 'boolean', description: 'Mock auth error' }
  }
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewPost: Story = {
  args: {
    placeholder: 'Share something with the network...',
    onSuccess: () => {},
    onCancel: () => {},
    autoFocus: false,
    loggedIn: true
  }
};

export const ReplyToNote: Story = {
  args: {
    parentEvent: mockEvent,
    placeholder: 'Write your reply...',
    onSuccess: () => {},
    onCancel: () => {},
    autoFocus: true,
    loggedIn: true
  }
};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Share your thoughts...',
    onSuccess: () => {},
    loggedIn: true
  }
};

export const WithAutoFocus: Story = {
  args: {
    placeholder: 'Share something with the network...',
    autoFocus: true,
    onSuccess: () => {},
    loggedIn: true
  }
};

export const NotAuthenticated: Story = {
  args: {
    placeholder: 'Share something with the network...',
    onSuccess: () => {},
    loggedIn: false
  }
};

export const AuthenticationError: Story = {
  args: {
    placeholder: 'Share something with the network...',
    onSuccess: () => {},
    loggedIn: false,
    authError: true
  }
};

export const WithCancelButton: Story = {
  args: {
    placeholder: 'Write your reply...',
    onSuccess: () => {},
    onCancel: () => {},
    loggedIn: true
  }
};

export const NoCancelButton: Story = {
  args: {
    placeholder: 'Share something with the network...',
    onSuccess: () => {},
    onCancel: undefined,
    loggedIn: true
  }
};

export const ReplyWithMentions: Story = {
  args: {
    parentEvent: {
      ...mockEvent,
      tags: [
        ['e', 'rootevent123456', '', 'root'],
        ['p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
        ['p', 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234']
      ]
    },
    placeholder: 'Reply with mentions...',
    onSuccess: () => {},
    onCancel: () => {},
    loggedIn: true
  }
};
