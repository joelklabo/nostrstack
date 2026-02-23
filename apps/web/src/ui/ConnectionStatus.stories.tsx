import '../styles/base/connection-status.css';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { type ConnectionState, ConnectionStatus, type NetworkType } from './ConnectionStatus';

const meta = {
  title: 'Components/ConnectionStatus',
  component: ConnectionStatus,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A status indicator component for Bitcoin telemetry connection state.

## State Machine

The component follows a deterministic state machine:

\`\`\`
          ┌───────────────────────────────────────────────────────────────┐
          │                                                               │
          │                    ┌─────────────┐                            │
          │     ┌──────────────│  CONNECTED  │◄─────────────┐             │
          │     │              └─────────────┘              │             │
          │     │                    │                      │             │
          │     │ ws close/          │ ws close             │ ws open     │
          │     │ browser offline    │ (retryable)          │             │
          │     ▼                    ▼                      │             │
          │ ┌─────────┐       ┌─────────────┐        ┌──────┴─────┐       │
          │ │ OFFLINE │◄──────│ RECONNECTING│◄───────│ CONNECTING │       │
          │ └─────────┘       └─────────────┘        └────────────┘       │
          │     │                    │                      ▲             │
          │     │                    │ max retries          │             │
          │     │ retry clicked      │ exceeded             │ init        │
          │     │ / browser online   │                      │             │
          │     └────────────────────┴──────────────────────┘             │
          │                                                               │
          │  ┌─────────┐                                                  │
          └──│  ERROR  │◄── auth error / fatal error                      │
             └─────────┘                                                  │
                  │                                                       │
                  │ retry clicked                                         │
                  └───────────────────────────────────────────────────────┘
\`\`\`

## Network Colors

- **Mainnet**: Green with glow (real money warning)
- **Testnet/Mutinynet/Signet**: Amber/warning
- **Regtest**: Teal/primary (local development)
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    state: {
      control: 'select',
      options: ['connecting', 'connected', 'reconnecting', 'offline', 'error'] as ConnectionState[],
      description: 'Current connection state'
    },
    network: {
      control: 'select',
      options: ['mainnet', 'testnet', 'mutinynet', 'signet', 'regtest', 'unknown'] as NetworkType[],
      description: 'Bitcoin network type'
    },
    lastSyncAt: {
      control: 'number',
      description: 'Last successful sync timestamp (Unix ms)'
    },
    reconnectAttempt: {
      control: { type: 'number', min: 0, max: 10 },
      description: 'Current reconnection attempt'
    },
    maxReconnectAttempts: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Maximum reconnection attempts'
    },
    errorMessage: {
      control: 'text',
      description: 'Error message when in error state'
    },
    compact: {
      control: 'boolean',
      description: 'Show compact version'
    }
  },
  args: {
    onRetry: fn(),
    state: 'connected',
    network: 'regtest',
    lastSyncAt: Date.now() - 30000, // 30 seconds ago
    maxReconnectAttempts: 8
  }
} satisfies Meta<typeof ConnectionStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Connection States
// ============================================================================

export const Connected: Story = {
  args: {
    state: 'connected',
    network: 'regtest',
    lastSyncAt: Date.now() - 5000 // 5 seconds ago (recent)
  }
};

export const Connecting: Story = {
  args: {
    state: 'connecting',
    network: 'regtest',
    lastSyncAt: null
  }
};

export const Reconnecting: Story = {
  args: {
    state: 'reconnecting',
    network: 'regtest',
    reconnectAttempt: 3,
    lastSyncAt: Date.now() - 60000 // 1 minute ago
  }
};

export const Offline: Story = {
  args: {
    state: 'offline',
    network: 'regtest',
    lastSyncAt: Date.now() - 300000 // 5 minutes ago
  }
};

export const Error: Story = {
  args: {
    state: 'error',
    network: 'regtest',
    errorMessage: 'Authentication required. Please check your API credentials.',
    lastSyncAt: Date.now() - 120000 // 2 minutes ago
  }
};

// ============================================================================
// Network Types
// ============================================================================

export const MainnetConnected: Story = {
  name: 'Mainnet (Connected)',
  args: {
    state: 'connected',
    network: 'mainnet',
    lastSyncAt: Date.now() - 3000
  }
};

export const TestnetConnected: Story = {
  name: 'Testnet (Connected)',
  args: {
    state: 'connected',
    network: 'testnet',
    lastSyncAt: Date.now() - 10000
  }
};

export const MutinynetConnected: Story = {
  name: 'Mutinynet (Connected)',
  args: {
    state: 'connected',
    network: 'mutinynet',
    lastSyncAt: Date.now() - 15000
  }
};

export const SignetConnected: Story = {
  name: 'Signet (Connected)',
  args: {
    state: 'connected',
    network: 'signet',
    lastSyncAt: Date.now() - 20000
  }
};

export const RegtestConnected: Story = {
  name: 'Regtest (Connected)',
  args: {
    state: 'connected',
    network: 'regtest',
    lastSyncAt: Date.now() - 2000
  }
};

// ============================================================================
// Compact Variants
// ============================================================================

export const CompactConnected: Story = {
  name: 'Compact - Connected',
  args: {
    state: 'connected',
    network: 'mainnet',
    compact: true
  }
};

export const CompactOffline: Story = {
  name: 'Compact - Offline',
  args: {
    state: 'offline',
    network: 'regtest',
    compact: true
  }
};

// ============================================================================
// Edge Cases
// ============================================================================

export const NeverSynced: Story = {
  name: 'Never Synced',
  args: {
    state: 'connecting',
    network: 'regtest',
    lastSyncAt: null
  }
};

export const StaleSyncTime: Story = {
  name: 'Stale Sync (Hours Ago)',
  args: {
    state: 'offline',
    network: 'regtest',
    lastSyncAt: Date.now() - 3600000 // 1 hour ago
  }
};

export const MaxReconnectAttempts: Story = {
  name: 'Max Reconnect Attempts',
  args: {
    state: 'reconnecting',
    network: 'regtest',
    reconnectAttempt: 8,
    maxReconnectAttempts: 8,
    lastSyncAt: Date.now() - 180000 // 3 minutes ago
  }
};

export const LongErrorMessage: Story = {
  name: 'Long Error Message',
  args: {
    state: 'error',
    network: 'mainnet',
    errorMessage:
      'Connection failed due to network timeout. The Bitcoin node at the configured endpoint is not responding. Please verify the node is running and the network configuration is correct.',
    lastSyncAt: Date.now() - 240000 // 4 minutes ago
  }
};

// ============================================================================
// All Networks Comparison
// ============================================================================

export const AllNetworksComparison: Story = {
  name: 'All Networks (Comparison)',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
      <ConnectionStatus state="connected" network="mainnet" lastSyncAt={Date.now() - 5000} />
      <ConnectionStatus state="connected" network="testnet" lastSyncAt={Date.now() - 10000} />
      <ConnectionStatus state="connected" network="mutinynet" lastSyncAt={Date.now() - 15000} />
      <ConnectionStatus state="connected" network="signet" lastSyncAt={Date.now() - 20000} />
      <ConnectionStatus state="connected" network="regtest" lastSyncAt={Date.now() - 2000} />
      <ConnectionStatus state="connected" network="unknown" lastSyncAt={Date.now() - 30000} />
    </div>
  )
};

// ============================================================================
// All States Comparison
// ============================================================================

export const AllStatesComparison: Story = {
  name: 'All States (Comparison)',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
      <ConnectionStatus state="connected" network="regtest" lastSyncAt={Date.now() - 3000} />
      <ConnectionStatus state="connecting" network="regtest" lastSyncAt={null} />
      <ConnectionStatus
        state="reconnecting"
        network="regtest"
        reconnectAttempt={3}
        maxReconnectAttempts={8}
        lastSyncAt={Date.now() - 60000}
      />
      <ConnectionStatus state="offline" network="regtest" lastSyncAt={Date.now() - 300000} />
      <ConnectionStatus
        state="error"
        network="regtest"
        errorMessage="Authentication required"
        lastSyncAt={Date.now() - 120000}
      />
    </div>
  )
};
