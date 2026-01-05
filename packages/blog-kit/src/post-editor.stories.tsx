import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { Event } from 'nostr-tools';
import { PostEditor } from './post-editor';
import { AuthProvider } from './auth';
import { NostrstackConfigProvider } from './context';

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
  signEvent: fn(async (template) => ({
    ...template,
    id: 'signed-event-id-' + Date.now(),
    sig: 'signed-event-sig',
    pubkey: 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234'
  }))
};

const mockAuthContextLoggedOut = {
  pubkey: null,
  mode: 'none',
  error: null,
  signEvent: fn(async () => {
    throw new Error('Not authenticated');
  })
};

const mockAuthContextError = {
  pubkey: null,
  mode: 'extension',
  error: 'Extension not found or permission denied.',
  signEvent: fn(async () => {
    throw new Error('Not authenticated');
  })
};

const mockConfig = {
  relays: ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
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
      let authContext = mockAuthContextLoggedIn;
      if (context.args.loggedIn === false) {
        authContext = mockAuthContextLoggedOut;
      } else if (context.args.authError) {
        authContext = mockAuthContextError;
      }
      
      return (
        <AuthProvider value={authContext}>
          <NostrstackConfigProvider value={mockConfig}>
            <div style={{ width: '600px', maxWidth: '90vw' }}>
              <Story />
            </div>
          </NostrstackConfigProvider>
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
} satisfies Meta<typeof PostEditor & { loggedIn?: boolean; authError?: boolean }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewPost: Story = {
  args: {
    placeholder: 'WHAT ARE YOU HACKING ON?...',
    onSuccess: fn(),
    onCancel: fn(),
    autoFocus: false,
    loggedIn: true
  }
};

export const ReplyToNote: Story = {
  args: {
    parentEvent: mockEvent,
    placeholder: 'Write your reply...',
    onSuccess: fn(),
    onCancel: fn(),
    autoFocus: true,
    loggedIn: true
  }
};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Share your thoughts...',
    onSuccess: fn(),
    loggedIn: true
  }
};

export const WithAutoFocus: Story = {
  args: {
    placeholder: 'WHAT ARE YOU HACKING ON?...',
    autoFocus: true,
    onSuccess: fn(),
    loggedIn: true
  }
};

export const NotAuthenticated: Story = {
  args: {
    placeholder: 'WHAT ARE YOU HACKING ON?...',
    onSuccess: fn(),
    loggedIn: false
  }
};

export const AuthenticationError: Story = {
  args: {
    placeholder: 'WHAT ARE YOU HACKING ON?...',
    onSuccess: fn(),
    loggedIn: false,
    authError: true
  }
};

export const WithCancelButton: Story = {
  args: {
    placeholder: 'Write your reply...',
    onSuccess: fn(),
    onCancel: fn(),
    loggedIn: true
  }
};

export const NoCancelButton: Story = {
  args: {
    placeholder: 'WHAT ARE YOU HACKING ON?...',
    onSuccess: fn(),
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
    onSuccess: fn(),
    onCancel: fn(),
    loggedIn: true
  }
};
