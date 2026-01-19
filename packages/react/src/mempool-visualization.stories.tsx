import type { Meta, StoryObj } from '@storybook/react';

import { type MempoolData, MempoolVisualization } from './mempool-visualization';

const meta: Meta<typeof MempoolVisualization> = {
  title: 'Blockchain/MempoolVisualization',
  component: MempoolVisualization,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A compact mempool visualization component showing:
- Total unconfirmed transactions count
- Total mempool size (vMB)
- Fee rate distribution (low/medium/high)
- Visual representation of congestion level

Uses color coding for congestion:
- **Green** = Low congestion (< 50 vMB or low fee < 5 sat/vB)
- **Yellow** = Moderate congestion (50-200 vMB or low fee 5-20 sat/vB)
- **Red** = High congestion (> 200 vMB or low fee > 20 sat/vB)
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    pollInterval: {
      control: { type: 'number', min: 0, max: 60000, step: 1000 },
      description: 'Polling interval in ms (0 to disable)'
    },
    compact: {
      control: 'boolean',
      description: 'Show compact single-row layout'
    }
  }
};

export default meta;
type Story = StoryObj<typeof MempoolVisualization>;

// Low congestion data
const lowCongestionData: MempoolData = {
  txCount: 8500,
  sizeVMB: 25,
  feeRates: {
    low: 1,
    medium: 2,
    high: 4
  },
  lastUpdated: Date.now()
};

// Medium congestion data
const mediumCongestionData: MempoolData = {
  txCount: 35000,
  sizeVMB: 120,
  feeRates: {
    low: 12,
    medium: 25,
    high: 45
  },
  lastUpdated: Date.now()
};

// High congestion data
const highCongestionData: MempoolData = {
  txCount: 85000,
  sizeVMB: 280,
  feeRates: {
    low: 35,
    medium: 75,
    high: 150
  },
  lastUpdated: Date.now()
};

/**
 * Default state with low congestion showing a healthy mempool.
 */
export const LowCongestion: Story = {
  args: {
    data: lowCongestionData,
    pollInterval: 0
  }
};

/**
 * Medium congestion state showing a moderately busy mempool.
 */
export const MediumCongestion: Story = {
  args: {
    data: mediumCongestionData,
    pollInterval: 0
  }
};

/**
 * High congestion state showing a very busy mempool with elevated fees.
 */
export const HighCongestion: Story = {
  args: {
    data: highCongestionData,
    pollInterval: 0
  }
};

/**
 * Compact mode for embedding in tight spaces.
 */
export const Compact: Story = {
  args: {
    data: mediumCongestionData,
    pollInterval: 0,
    compact: true
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    )
  ]
};

/**
 * Loading state before data is fetched.
 */
export const Loading: Story = {
  args: {
    pollInterval: 0
  },
  render: () => {
    // Force loading state by not providing initial data
    return <MempoolVisualization pollInterval={0} />;
  }
};

/**
 * Live updating with mock data (polls every 3 seconds for demo).
 */
export const LiveUpdating: Story = {
  args: {
    pollInterval: 3000
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates live updates with random mock data every 3 seconds.'
      }
    }
  }
};

/**
 * Custom fetch function example showing how to integrate with external APIs.
 */
export const CustomFetch: Story = {
  args: {
    pollInterval: 5000,
    fetchData: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        txCount: Math.floor(Math.random() * 50000) + 10000,
        sizeVMB: Math.floor(Math.random() * 250) + 20,
        feeRates: {
          low: Math.floor(Math.random() * 15) + 1,
          medium: Math.floor(Math.random() * 40) + 10,
          high: Math.floor(Math.random() * 100) + 40
        },
        lastUpdated: Date.now()
      };
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how to use a custom fetch function to integrate with mempool.space or other APIs.'
      }
    }
  }
};

/**
 * Dark theme support (inherits from ns-theme).
 */
export const DarkTheme: Story = {
  args: {
    data: mediumCongestionData,
    pollInterval: 0
  },
  decorators: [
    (Story) => (
      <div
        data-theme="dark"
        className="ns-theme"
        style={{ padding: '2rem', background: '#1a1a2e' }}
      >
        <Story />
      </div>
    )
  ]
};

/**
 * All congestion levels side by side for comparison.
 */
export const AllLevels: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <MempoolVisualization data={lowCongestionData} pollInterval={0} />
      <MempoolVisualization data={mediumCongestionData} pollInterval={0} />
      <MempoolVisualization data={highCongestionData} pollInterval={0} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows all three congestion levels side by side for visual comparison.'
      }
    }
  }
};
