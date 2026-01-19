import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { type BlockData, BlockNotification, BlockNotificationInline } from './BlockNotification';

const meta: Meta<typeof BlockNotification> = {
  title: 'Telemetry/BlockNotification',
  component: BlockNotification,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A real-time Bitcoin block notification component with heartbeat/pulse animation.

## Features
- Attention-grabbing entrance animation for new blocks
- Heartbeat pulse effect that fades over time (intensity decreases as block ages)
- Shows block height, time since last block, transaction count, and size
- Optional sound notification
- Auto-dismiss functionality
- Respects \`prefers-reduced-motion\`
- Full accessibility support with ARIA live regions
- Dark theme support

## Animation Design
The component features a "heartbeat" metaphor - the pulse intensity represents the Bitcoin network's vital signs:
- Fresh blocks (< 1 min): Strong, fast pulse
- Aging blocks (1-5 min): Moderate pulse
- Old blocks (5-10 min): Faint, slow pulse
- Very old (10+ min): Minimal pulse
        `
      }
    }
  },
  argTypes: {
    block: {
      description: 'Block data to display',
      control: 'object'
    },
    timeSinceLastBlock: {
      description: 'Time since last block in seconds',
      control: { type: 'number', min: 0, max: 3600 }
    },
    autoDismiss: {
      description: 'Whether to auto-dismiss after animation',
      control: 'boolean'
    },
    autoDismissDelay: {
      description: 'Auto-dismiss delay in milliseconds',
      control: { type: 'number', min: 1000, max: 30000 }
    },
    soundEnabled: {
      description: 'Enable sound notification for new blocks',
      control: 'boolean'
    }
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', padding: '20px' }}>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof BlockNotification>;

const sampleBlock: BlockData = {
  height: 879456,
  time: Math.floor(Date.now() / 1000) - 30,
  txCount: 3247,
  size: 1678432,
  hash: '0000000000000000000234abc123def456789abcdef123456789abcdef123456'
};

/**
 * Default block notification showing a recently found block.
 */
export const Default: Story = {
  args: {
    block: sampleBlock,
    timeSinceLastBlock: 547,
    autoDismiss: false
  }
};

/**
 * Story component for new block animation demo.
 */
function NewBlockDemo() {
  const [block, setBlock] = useState<BlockData | null>(null);

  useEffect(() => {
    // Simulate initial block
    setBlock({
      height: 879455,
      time: Math.floor(Date.now() / 1000) - 600,
      txCount: 2891,
      size: 1534892,
      hash: '0000000000000000000111aaa111bbb222ccc333ddd444eee555fff666777888'
    });

    // Simulate new block arriving after 2 seconds
    const timeout = setTimeout(() => {
      setBlock({
        height: 879456,
        time: Math.floor(Date.now() / 1000),
        txCount: 3247,
        size: 1678432,
        hash: '0000000000000000000234abc123def456789abcdef123456789abcdef123456'
      });
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  return <BlockNotification block={block} autoDismiss={false} soundEnabled={false} />;
}

/**
 * Notification for a brand new block (triggers entrance animation).
 */
export const NewBlock: Story = {
  render: () => <NewBlockDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Watch for the new block animation after 2 seconds. The component detects when block height increases and triggers the entrance animation with pulse effects.'
      }
    }
  }
};

/**
 * With sound enabled (click to test).
 */
export const WithSound: Story = {
  args: {
    block: sampleBlock,
    autoDismiss: false,
    soundEnabled: true
  },
  parameters: {
    docs: {
      description: {
        story:
          'Sound notifications require user interaction to enable. When a new block arrives, a pleasant two-tone chime plays.'
      }
    }
  }
};

/**
 * Aging block with reduced pulse intensity.
 */
export const AgingBlock: Story = {
  args: {
    block: {
      ...sampleBlock,
      time: Math.floor(Date.now() / 1000) - 300 // 5 minutes ago
    },
    timeSinceLastBlock: 300,
    autoDismiss: false
  },
  parameters: {
    docs: {
      description: {
        story:
          'Block found 5 minutes ago. Notice the reduced pulse intensity - the heartbeat fades as the block ages.'
      }
    }
  }
};

/**
 * Old block with minimal animation.
 */
export const OldBlock: Story = {
  args: {
    block: {
      ...sampleBlock,
      time: Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
    },
    timeSinceLastBlock: 600,
    autoDismiss: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Block found 10+ minutes ago. Pulse animation is at minimum intensity.'
      }
    }
  }
};

/**
 * Minimal block data (no tx count or size).
 */
export const MinimalData: Story = {
  args: {
    block: {
      height: 879456,
      time: Math.floor(Date.now() / 1000) - 120
    },
    autoDismiss: false
  },
  parameters: {
    docs: {
      description: {
        story:
          'When only height and time are available, the component gracefully hides the stats section.'
      }
    }
  }
};

/**
 * Auto-dismiss after delay.
 */
export const AutoDismiss: Story = {
  args: {
    block: sampleBlock,
    autoDismiss: true,
    autoDismissDelay: 5000,
    onDismiss: () => console.log('Dismissed')
  },
  parameters: {
    docs: {
      description: {
        story: 'This notification will auto-dismiss after 5 seconds.'
      }
    }
  }
};

/**
 * Story component for inline variants demo.
 */
function InlineDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <BlockNotificationInline block={sampleBlock} />
      <BlockNotificationInline
        block={{
          ...sampleBlock,
          time: Math.floor(Date.now() / 1000) - 300
        }}
      />
    </div>
  );
}

/**
 * Inline variant for compact displays.
 */
export const Inline: StoryObj<typeof BlockNotificationInline> = {
  render: () => <InlineDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Compact inline variant suitable for sidebars or tight spaces. Shows block height and time since block.'
      }
    }
  }
};

/**
 * Story component for inline new block animation demo.
 */
function InlineNewBlockDemo() {
  const [block, setBlock] = useState<BlockData>({
    height: 879455,
    time: Math.floor(Date.now() / 1000) - 300
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBlock({
        height: 879456,
        time: Math.floor(Date.now() / 1000)
      });
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  return <BlockNotificationInline block={block} />;
}

/**
 * Inline with new block animation.
 */
export const InlineNewBlock: StoryObj<typeof BlockNotificationInline> = {
  render: () => <InlineNewBlockDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Watch the inline notification react to a new block after 2 seconds.'
      }
    }
  }
};

/**
 * Dark theme variant.
 */
export const DarkTheme: Story = {
  args: {
    block: sampleBlock,
    autoDismiss: false
  },
  decorators: [
    (Story) => (
      <div
        data-theme="dark"
        style={{
          width: '360px',
          padding: '20px',
          background: '#0f172a',
          borderRadius: '8px'
        }}
      >
        <Story />
      </div>
    )
  ],
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Dark theme variant with adjusted colors and contrast.'
      }
    }
  }
};

/**
 * Story component for live simulation demo.
 */
function LiveSimulationDemo() {
  const [block, setBlock] = useState<BlockData>({
    height: 879450,
    time: Math.floor(Date.now() / 1000) - 600,
    txCount: 2500,
    size: 1500000,
    hash: '0000000000000000000aaa111bbb222ccc333ddd444eee555fff666777888999'
  });

  useEffect(() => {
    // Simulate new blocks every 10 seconds
    const interval = setInterval(() => {
      setBlock((prev) => ({
        height: prev.height + 1,
        time: Math.floor(Date.now() / 1000),
        txCount: 2000 + Math.floor(Math.random() * 2000),
        size: 1200000 + Math.floor(Math.random() * 800000),
        hash: '0000000000000000000' + Math.random().toString(36).substring(2, 47)
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return <BlockNotification block={block} autoDismiss={false} soundEnabled={false} />;
}

/**
 * Simulated live updates.
 */
export const LiveSimulation: Story = {
  render: () => <LiveSimulationDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Live simulation with new blocks arriving every 10 seconds. Watch the entrance animation and pulse effects.'
      }
    }
  }
};
