import type { Meta, StoryObj } from '@storybook/react';
import type { Event } from 'nostr-tools';
import { NotificationItem, type NotificationGroup } from './NotificationItem';

// Mock events for different notification types
const mockReactionEvent: Event = {
  id: 'reaction1',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  created_at: Math.floor(Date.now() / 1000) - 300,
  kind: 7,
  tags: [
    ['e', 'target-event-123'],
    ['p', 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234']
  ],
  content: '+',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const mockZapEvent: Event = {
  id: 'zap1',
  pubkey: 'cafe4321cafe4321cafe4321cafe4321cafe4321cafe4321cafe4321cafe4321',
  created_at: Math.floor(Date.now() / 1000) - 600,
  kind: 9735,
  tags: [
    ['e', 'target-event-456'],
    ['p', 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234'],
    ['amount', '21000']
  ],
  content: '',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const mockMentionEvent: Event = {
  id: 'mention1',
  pubkey: 'beef1234beef1234beef1234beef1234beef1234beef1234beef1234beef1234',
  created_at: Math.floor(Date.now() / 1000) - 900,
  kind: 1,
  tags: [
    ['p', 'cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234']
  ],
  content: 'Hey @cafe1234cafe1234 check this out!',
  sig: '0000000000000000000000000000000000000000000000000000000000000000'
};

const reactionGroup: NotificationGroup = {
  id: 'reaction-group-1',
  type: 'reaction',
  events: [mockReactionEvent],
  targetEventId: 'target-event-123',
  timestamp: mockReactionEvent.created_at
};

const multipleReactionsGroup: NotificationGroup = {
  id: 'reaction-group-2',
  type: 'reaction',
  events: [
    mockReactionEvent,
    { ...mockReactionEvent, id: 'reaction2', pubkey: 'beef5678beef5678beef5678beef5678beef5678beef5678beef5678beef5678' }
  ],
  targetEventId: 'target-event-123',
  timestamp: mockReactionEvent.created_at
};

const manyReactionsGroup: NotificationGroup = {
  id: 'reaction-group-3',
  type: 'reaction',
  events: [
    mockReactionEvent,
    { ...mockReactionEvent, id: 'reaction2', pubkey: 'beef5678beef5678beef5678beef5678beef5678beef5678beef5678beef5678' },
    { ...mockReactionEvent, id: 'reaction3', pubkey: 'cafe9999cafe9999cafe9999cafe9999cafe9999cafe9999cafe9999cafe9999' },
    { ...mockReactionEvent, id: 'reaction4', pubkey: 'dead9999dead9999dead9999dead9999dead9999dead9999dead9999dead9999' }
  ],
  targetEventId: 'target-event-123',
  timestamp: mockReactionEvent.created_at
};

const zapGroup: NotificationGroup = {
  id: 'zap-group-1',
  type: 'zap',
  events: [mockZapEvent],
  targetEventId: 'target-event-456',
  timestamp: mockZapEvent.created_at
};

const multipleZapsGroup: NotificationGroup = {
  id: 'zap-group-2',
  type: 'zap',
  events: [
    mockZapEvent,
    { ...mockZapEvent, id: 'zap2', pubkey: 'beef8888beef8888beef8888beef8888beef8888beef8888beef8888beef8888', tags: [['e', 'target-event-456'], ['p', 'cafe1234'], ['amount', '100000']] }
  ],
  targetEventId: 'target-event-456',
  timestamp: mockZapEvent.created_at
};

const mentionGroup: NotificationGroup = {
  id: 'mention-group-1',
  type: 'mention',
  events: [mockMentionEvent],
  targetEventId: mockMentionEvent.id,
  timestamp: mockMentionEvent.created_at
};

const meta = {
  title: 'Complex/NotificationItem',
  component: NotificationItem,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    group: { control: false }
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px', background: 'var(--color-canvas-default)', border: '1px solid var(--color-border-default)', borderRadius: '8px' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NotificationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleReaction: Story = {
  args: {
    group: reactionGroup
  }
};

export const MultipleReactions: Story = {
  args: {
    group: multipleReactionsGroup
  }
};

export const ManyReactions: Story = {
  args: {
    group: manyReactionsGroup
  }
};

export const SingleZap: Story = {
  args: {
    group: zapGroup
  }
};

export const MultipleZaps: Story = {
  args: {
    group: multipleZapsGroup
  }
};

export const Mention: Story = {
  args: {
    group: mentionGroup
  }
};

export const NoTargetEvent: Story = {
  args: {
    group: {
      ...reactionGroup,
      targetEventId: undefined
    }
  }
};

export const NotificationList: Story = {
  render: () => (
    <div style={{ width: '600px', background: 'var(--color-canvas-default)', border: '1px solid var(--color-border-default)', borderRadius: '8px' }}>
      <NotificationItem group={reactionGroup} />
      <NotificationItem group={zapGroup} />
      <NotificationItem group={mentionGroup} />
      <NotificationItem group={multipleReactionsGroup} />
      <NotificationItem group={multipleZapsGroup} />
    </div>
  ),
  args: {}
};
