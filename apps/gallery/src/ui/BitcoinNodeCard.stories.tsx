import type { Meta, StoryObj } from '@storybook/react';

import { BitcoinNodeCard } from './BitcoinNodeCard';

const meta = {
  title: 'UI/BitcoinNodeCard',
  component: BitcoinNodeCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '600px', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BitcoinNodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Healthy mainnet node
export const MainnetHealthy: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 825000,
      hash: '00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054',
      time: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
      connections: 12,
      headers: 825000,
      blocks: 825000,
      verificationProgress: 0.9999,
      initialBlockDownload: false,
      mempoolTxs: 4523,
      mempoolBytes: 12500000,
      version: '26.0.0',
      lightning: {
        provider: 'lnbits',
        lnbits: {
          status: 'ok',
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'A fully synced mainnet node with healthy LNbits Lightning provider.',
      },
    },
  },
};

// Regtest node for development
export const RegtestDevelopment: Story = {
  args: {
    info: {
      network: 'regtest',
      configuredNetwork: 'regtest',
      source: 'bitcoind',
      height: 150,
      hash: '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
      time: Math.floor(Date.now() / 1000) - 5, // 5 seconds ago
      connections: 0,
      headers: 150,
      blocks: 150,
      verificationProgress: 1.0,
      initialBlockDownload: false,
      mempoolTxs: 0,
      mempoolBytes: 0,
      version: '26.0.0',
      lightning: {
        provider: 'lnbits',
        lnbits: {
          status: 'ok',
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Local regtest node used for development and testing.',
      },
    },
  },
};

// Testnet/Mutinynet node
export const TestnetNode: Story = {
  args: {
    info: {
      network: 'mutinynet',
      configuredNetwork: 'mutinynet',
      source: 'bitcoind',
      height: 2500000,
      hash: '00000000000002b321e93e9979ec1456f01d738e0e8012a2fa3f8e1c14e6d78f',
      time: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
      connections: 8,
      headers: 2500000,
      blocks: 2500000,
      verificationProgress: 0.9999,
      initialBlockDownload: false,
      mempoolTxs: 12,
      mempoolBytes: 45000,
      version: '25.1.0',
      lightning: {
        provider: 'lnbits',
        lnbits: {
          status: 'ok',
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Mutinynet testnet node for testing Lightning functionality.',
      },
    },
  },
};

// Node syncing (Initial Block Download)
export const NodeSyncing: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 500000,
      hash: '00000000000000000024fb37364cbf81fd49cc2d51c09c75c35433c3a1945d04',
      time: Math.floor(Date.now() / 1000) - 300,
      connections: 10,
      headers: 825000,
      blocks: 500000,
      verificationProgress: 0.606, // ~60% synced
      initialBlockDownload: true,
      mempoolTxs: 0,
      mempoolBytes: 0,
      version: '26.0.0',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node in the middle of initial sync, showing progress.',
      },
    },
  },
};

// Node with LNbits error
export const LightningError: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 825000,
      hash: '00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054',
      time: Math.floor(Date.now() / 1000) - 120,
      connections: 12,
      headers: 825000,
      blocks: 825000,
      verificationProgress: 0.9999,
      initialBlockDownload: false,
      mempoolTxs: 4523,
      mempoolBytes: 12500000,
      version: '26.0.0',
      lightning: {
        provider: 'lnbits',
        lnbits: {
          status: 'fail',
          reason: 'Connection timeout',
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node with LNbits Lightning provider in failed state.',
      },
    },
  },
};

// Node with telemetry error
export const TelemetryDegraded: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 825000,
      time: Math.floor(Date.now() / 1000) - 120,
      connections: 12,
      version: '26.0.0',
      telemetryError: 'WebSocket connection lost. Showing cached data.',
      lightning: {
        provider: 'lnbits',
        lnbits: {
          status: 'skipped',
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node with telemetry connection issues, showing warning alert.',
      },
    },
  },
};

// Minimal data (offline/bootstrap state)
export const OfflineMinimal: Story = {
  args: {
    info: {
      configuredNetwork: 'mainnet',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node with minimal data, likely offline or just starting up.',
      },
    },
  },
};

// Chain mismatch warning
export const ChainMismatch: Story = {
  args: {
    info: {
      network: 'testnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 2500000,
      hash: '00000000000002b321e93e9979ec1456f01d738e0e8012a2fa3f8e1c14e6d78f',
      time: Math.floor(Date.now() / 1000) - 600,
      connections: 8,
      headers: 2500000,
      blocks: 2500000,
      verificationProgress: 0.9999,
      version: '26.0.0',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Configuration mismatch: node is on testnet but configured for mainnet.',
      },
    },
  },
};

// Offline with no network info
export const OfflineNoNetwork: Story = {
  args: {
    info: {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Completely offline node with no data - shows all fields as dashes.',
      },
    },
  },
};

// Unknown Lightning provider
export const UnknownLightningProvider: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 825000,
      time: Math.floor(Date.now() / 1000) - 120,
      connections: 12,
      version: '26.0.0',
      lightning: {
        provider: 'unknown-provider',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node with unknown Lightning provider type.',
      },
    },
  },
};

// Zero sync progress
export const ZeroSyncProgress: Story = {
  args: {
    info: {
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'bitcoind',
      height: 0,
      connections: 2,
      headers: 825000,
      blocks: 0,
      verificationProgress: 0.0,
      initialBlockDownload: true,
      version: '26.0.0',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node just started syncing with 0% progress.',
      },
    },
  },
};

// Missing timestamp (stale data)
export const MissingTimestamp: Story = {
  args: {
    info: {
      network: 'regtest',
      configuredNetwork: 'regtest',
      source: 'bitcoind',
      height: 150,
      connections: 0,
      version: '26.0.0',
      // No time field
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Node data without timestamp - shows dash for "Last Block" age.',
      },
    },
  },
};
