import type { Meta, StoryObj } from '@storybook/react';

import { ProfileLink } from './ProfileLink';

const meta = {
  title: 'UI/ProfileLink',
  component: ProfileLink,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    pubkey: { control: 'text' },
    label: { control: 'text' },
    className: { control: 'text' },
    title: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', fontSize: '16px', lineHeight: '1.6' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileLink>;

export default meta;
type Story = StoryObj<typeof meta>;

// Example pubkeys for stories
const SAMPLE_PUBKEYS = {
  alice: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  bob: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
  charlie: 'e2ccf7cf20403f3f2a4a55b328f0de3be38558a7d5f33632fdaaefc726c1c8eb',
};

// Default with full pubkey
export const Default: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.alice,
  },
  parameters: {
    docs: {
      description: {
        story: 'Default ProfileLink showing full pubkey as link text.',
      },
    },
  },
};

// With custom label (username)
export const WithUsername: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.alice,
    label: '@alice',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with a custom label (like a username) instead of showing the pubkey.',
      },
    },
  },
};

// With display name
export const WithDisplayName: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.bob,
    label: 'Bob Smith',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with a full display name.',
      },
    },
  },
};

// With npub format label
export const WithNpubLabel: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.charlie,
    label: 'npub1utx0...c1c8eb',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with abbreviated npub format as label.',
      },
    },
  },
};

// With custom title (tooltip)
export const WithCustomTitle: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.alice,
    label: '@alice',
    title: 'Alice - Bitcoin developer',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with custom title attribute for tooltip.',
      },
    },
  },
};

// Custom styling
export const CustomStyling: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.bob,
    label: '@bob',
    className: 'profile-link-custom',
    style: {
      color: '#0969da',
      fontWeight: 600,
      textDecoration: 'none',
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      background: '#ddf4ff',
      border: '1px solid rgba(9, 105, 218, 0.4)',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with custom styling applied via className and style props.',
      },
    },
  },
};

// In a sentence context
export const InSentence: Story = {
  render: (args) => (
    <p style={{ maxWidth: '500px' }}>
      Check out <ProfileLink {...args} /> who posted about this yesterday. They have some great insights on Lightning Network development.
    </p>
  ),
  args: {
    pubkey: SAMPLE_PUBKEYS.charlie,
    label: '@charlie',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink used inline within text content.',
      },
    },
  },
};

// Multiple profile links
export const MultipleLinks: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div>
        👤 <ProfileLink pubkey={SAMPLE_PUBKEYS.alice} label="@alice" /> - Maintainer
      </div>
      <div>
        👤 <ProfileLink pubkey={SAMPLE_PUBKEYS.bob} label="@bob" /> - Contributor
      </div>
      <div>
        👤 <ProfileLink pubkey={SAMPLE_PUBKEYS.charlie} label="@charlie" /> - Reviewer
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple ProfileLinks in a list.',
      },
    },
  },
};

// Link in a web card
export const InWebCard: Story = {
  render: (args) => (
    <div
      style={{
        border: '1px solid #d0d7de',
        borderRadius: '8px',
        padding: '1rem',
        background: '#ffffff',
        maxWidth: '400px',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        />
        <div>
          <div style={{ fontWeight: 600 }}>
            <ProfileLink {...args} />
          </div>
          <div style={{ fontSize: '0.875rem', color: '#57606a' }}>2 hours ago</div>
        </div>
      </div>
      <p style={{ margin: 0, color: '#24292f' }}>
        Just published a new article about building on Nostr! Check it out ⚡
      </p>
    </div>
  ),
  args: {
    pubkey: SAMPLE_PUBKEYS.alice,
    label: 'Alice',
  },
  parameters: {
    docs: {
      description: {
      story: 'ProfileLink used in a web card UI.',
      },
    },
  },
};

// Link with hover states (interactive)
export const HoverStates: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.bob,
    label: '@bob',
    style: {
      color: '#0969da',
      textDecoration: 'none',
      transition: 'all 0.2s',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover over the link to see the default browser hover behavior. Custom hover styles can be applied via CSS.',
      },
    },
    pseudo: {
      hover: true,
    },
  },
};

// Invalid pubkey format
export const InvalidPubkey: Story = {
  args: {
    pubkey: 'invalid-pubkey-format-123',
    label: 'Invalid User',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with an invalid pubkey format - tests error handling.',
      },
    },
  },
};

// Npub format input (bech32)
export const NpubInput: Story = {
  args: {
    pubkey: 'npub1873nxq35ep4ufajey70l5a0x8gws4mfjlckgxsyf9z04vqhqfvxqmrmnwe',
    label: 'User from npub',
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with npub (bech32) format input - component should handle conversion.',
      },
    },
  },
};

// Default title behavior (no custom title)
export const DefaultTitleBehavior: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.alice,
    label: '@alice',
    // No title prop - should default to pubkey
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink without custom title - defaults to showing full pubkey on hover.',
      },
    },
  },
};

// With onClick interceptor
export const ClickIntercept: Story = {
  args: {
    pubkey: SAMPLE_PUBKEYS.bob,
    label: '@bob',
    onClick: (e) => {
      e.preventDefault();
      alert('Navigation intercepted! Link click prevented.');
      console.log('Click event:', e);
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'ProfileLink with custom onClick handler that prevents navigation.',
      },
    },
  },
};
