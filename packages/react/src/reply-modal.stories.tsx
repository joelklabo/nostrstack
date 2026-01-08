import type { Meta, StoryObj } from '@storybook/react';
import type { Event, EventTemplate } from 'nostr-tools';
import type React from 'react';
import { useState } from 'react';

import type { AuthContextType} from './auth';
import { AuthProvider } from './auth';
import { NostrstackProvider } from './context';
import { ReplyModal } from './reply-modal';

const mockEvent: Event = {
  id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [['p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef']],
  content: 'This is a great note about Nostr!',
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

const mockConfig = {
  relays: ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
};

type StoryArgs = React.ComponentProps<typeof ReplyModal> & { loggedIn?: boolean };

const meta = {
  title: 'Nostr/ReplyModal',
  component: ReplyModal,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const args = context.args as StoryArgs;
      const authContext =
        args.loggedIn !== false ? mockAuthContextLoggedIn : mockAuthContextLoggedOut;
      return (
        <AuthProvider value={authContext as unknown as AuthContextType}>
          <NostrstackProvider {...mockConfig}>
            <Story />
          </NostrstackProvider>
        </AuthProvider>
      );
    }
  ],
  argTypes: {
    isOpen: { control: 'boolean' },
    onClose: { action: 'close' },
    parentEvent: { control: false },
    loggedIn: { control: 'boolean' }
  }
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper to control modal state
function InteractiveReplyModal(args: { parentEvent: Event; onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    args.onClose();
    // Reopen after a delay for Storybook demo
    setTimeout(() => setIsOpen(true), 1000);
  };

  return (
    <div>
      <button className="action-btn" onClick={() => setIsOpen(true)}>
        Open Reply Modal
      </button>
      <ReplyModal isOpen={isOpen} onClose={handleClose} parentEvent={args.parentEvent} />
    </div>
  );
}

export const Default: Story = {
  args: {
    isOpen: true,
    parentEvent: mockEvent,
    onClose: () => {}
  }
};

export const Closed: Story = {
  args: {
    isOpen: false,
    parentEvent: mockEvent,
    onClose: () => {}
  }
};

export const Interactive: Story = {
  render: (args) => <InteractiveReplyModal {...args} />,
  args: {
    isOpen: true,
    parentEvent: mockEvent,
    onClose: () => {}
  }
};

export const ReplyToThread: Story = {
  args: {
    isOpen: true,
    parentEvent: {
      ...mockEvent,
      tags: [
        ['e', 'rootevent123456', '', 'root'],
        ['p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
        ['p', 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234']
      ],
      content: 'Reply in a threaded conversation with multiple mentions.'
    },
    onClose: () => {}
  }
};

export const LongContent: Story = {
  args: {
    isOpen: true,
    parentEvent: {
      ...mockEvent,
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    },
    onClose: () => {}
  }
};
