import type { Meta, StoryObj } from '@storybook/react';

import { JsonView } from './JsonView';

const meta = {
  title: 'UI/JsonView',
  component: JsonView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof JsonView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleObject: Story = {
  args: {
    value: { name: 'Alice', age: 30, active: true },
    title: 'User Data',
  },
};

export const NostrEvent: Story = {
  args: {
    value: {
      id: 'abc123...',
      pubkey: 'npub1...',
      created_at: 1704398400,
      kind: 1,
      tags: [],
      content: 'Hello Nostr!',
      sig: 'signature...',
    },
    title: 'Nostr Event',
  },
};

export const Array: Story = {
  args: {
    value: ['relay1.example.com', 'relay2.example.com', 'relay3.example.com'],
    title: 'Relay List',
  },
};
