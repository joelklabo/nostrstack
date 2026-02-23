import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { LiveStatsTicker, type NetworkStats } from './LiveStatsTicker';

const meta = {
  title: 'UI/LiveStatsTicker',
  component: LiveStatsTicker,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '320px', padding: '1rem' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof LiveStatsTicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to simulate live updates
function useLiveStats(initialStats: NetworkStats, updateInterval = 3000): NetworkStats {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        blockHeight: prev.blockHeight + (Math.random() > 0.7 ? 1 : 0), // 30% chance of new block
        hashrate: prev.hashrate ? prev.hashrate + (Math.random() - 0.5) * 5 : undefined,
        lastBlockTime: Math.random() > 0.7 ? Math.floor(Date.now() / 1000) : prev.lastBlockTime
      }));
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return stats;
}

// Static mainnet stats
export const MainnetStatic: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 756.2,
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 180
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Static mainnet network stats showing all fields.'
      }
    }
  }
};

// Live updating stats
const LiveUpdatingComponent = () => {
  const stats = useLiveStats({
    blockHeight: 878_543,
    hashrate: 756.2,
    difficulty: 109_780_000_000_000,
    lastBlockTime: Math.floor(Date.now() / 1000) - 30
  });

  return <LiveStatsTicker stats={stats} />;
};

export const LiveUpdating: Story = {
  render: () => <LiveUpdatingComponent />,
  parameters: {
    docs: {
      description: {
        story:
          'Stats that update automatically every 3 seconds. Watch for the pulse animation when values change and the odometer-style digit transitions.'
      }
    }
  }
};

// Compact variant
export const Compact: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 756.2,
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 45
    },
    compact: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact variant for tighter spaces like sidebars.'
      }
    }
  }
};

// Recently found block
export const RecentBlock: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 756.2,
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 15 // 15 seconds ago
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Block found very recently - shows "Just now" badge with green highlight.'
      }
    }
  }
};

// Minimal data (height only)
export const MinimalData: Story = {
  args: {
    stats: {
      blockHeight: 878_543
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Only block height available - other stats are hidden.'
      }
    }
  }
};

// Regtest network
export const RegtestNetwork: Story = {
  args: {
    stats: {
      blockHeight: 150,
      lastBlockTime: Math.floor(Date.now() / 1000) - 5
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Regtest network with low block height.'
      }
    }
  }
};

// Very high hashrate (ZH/s display)
export const HighHashrate: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 1250, // 1.25 ZH/s
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 300
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Very high hashrate displayed in ZH/s instead of EH/s.'
      }
    }
  }
};

// Without labels
export const NoLabels: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 756.2,
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 180
    },
    showLabels: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Stats displayed without text labels - icons only.'
      }
    }
  }
};

// Sidebar width simulation
const SidebarComponent = () => {
  const stats = useLiveStats({
    blockHeight: 878_543,
    hashrate: 756.2,
    difficulty: 109_780_000_000_000,
    lastBlockTime: Math.floor(Date.now() / 1000) - 120
  });

  return (
    <div style={{ width: '240px', background: 'var(--ns-color-bg-muted)', padding: '1rem' }}>
      <LiveStatsTicker stats={stats} compact className="live-stats-ticker--sidebar" />
    </div>
  );
};

export const InSidebar: Story = {
  render: () => <SidebarComponent />,
  decorators: [
    (Story) => (
      <div style={{ width: '260px' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Ticker optimized for sidebar width (single column layout).'
      }
    }
  }
};

// Rapid block updates simulation
const RapidBlocksComponent = () => {
  const [stats, setStats] = useState<NetworkStats>({
    blockHeight: 150,
    lastBlockTime: Math.floor(Date.now() / 1000)
  });

  useEffect(() => {
    // Simulate rapid regtest blocks every 1 second
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        blockHeight: prev.blockHeight + 1,
        lastBlockTime: Math.floor(Date.now() / 1000)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <LiveStatsTicker stats={stats} />;
};

export const RapidBlocks: Story = {
  render: () => <RapidBlocksComponent />,
  parameters: {
    docs: {
      description: {
        story:
          'Simulates rapid block production (like regtest with auto-mining). Watch the odometer animation on every block.'
      }
    }
  }
};

// Dark theme preview
export const DarkTheme: Story = {
  args: {
    stats: {
      blockHeight: 878_543,
      hashrate: 756.2,
      difficulty: 109_780_000_000_000,
      lastBlockTime: Math.floor(Date.now() / 1000) - 180
    }
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" style={{ width: '320px', padding: '1rem', background: '#1a1a1a' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Component with dark theme applied.'
      }
    }
  }
};
