import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { Event } from 'nostr-tools';
import { useState } from 'react';
import { ReplyModal } from './reply-modal';
import { AuthProvider } from './auth';
import { NostrstackConfigProvider } from './context';

const mockEvent: Event = {
  id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [
    ['p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef']
  ],
  content: 'This is a great note about Nostr!',
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

const mockConfig = {
  relays: ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol']
};

const meta = {
  title: 'Nostr/ReplyModal',
  component: ReplyModal,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <AuthProvider value={mockAuthContextLoggedIn}>
        <NostrstackConfigProvider value={mockConfig}>
          <Story />
        </NostrstackConfigProvider>
      </AuthProvider>
    )
  ],
  argTypes: {
    isOpen: { control: 'boolean' },
    onClose: { action: 'close' },
    parentEvent: { control: false }
  }
} satisfies Meta<typeof ReplyModal>;

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
      <ReplyModal
        isOpen={isOpen}
        onClose={handleClose}
        parentEvent={args.parentEvent}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    isOpen: true,
    parentEvent: mockEvent,
    onClose: fn()
  }
};

export const Closed: Story = {
  args: {
    isOpen: false,
    parentEvent: mockEvent,
    onClose: fn()
  }
};

export const Interactive: Story = {
  render: (args) => <InteractiveReplyModal {...args} />,
  args: {
    parentEvent: mockEvent,
    onClose: fn()
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
    onClose: fn()
  }
};

export const LongContent: Story = {
  args: {
    isOpen: true,
    parentEvent: {
      ...mockEvent,
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    },
    onClose: fn()
  }
};
