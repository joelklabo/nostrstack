import type { Meta, StoryObj } from '@storybook/react';

import { BitcoinNodeCard } from './BitcoinNodeCard';
import {
  ActivityLogSkeleton,
  BitcoinNodeCardSkeleton,
  RelaysSkeleton
} from './BitcoinNodeCardSkeleton';
import {
  ReconnectingIndicator,
  StaleDataIndicator,
  TelemetrySidebarSkeleton
} from './TelemetrySidebarSkeleton';

/**
 * Loading and skeleton states for the Bitcoin telemetry sidebar.
 * These components provide visual feedback during data fetching,
 * reconnection attempts, and stale data scenarios.
 */
const meta = {
  title: 'Telemetry/Loading States',
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: '320px',
          background: 'var(--ns-color-surface-default)',
          padding: '1rem'
        }}
      >
        <Story />
      </div>
    )
  ]
} satisfies Meta;

export default meta;

// ===== BITCOIN NODE CARD SKELETON =====

export const NodeCardSkeleton: StoryObj = {
  render: () => <BitcoinNodeCardSkeleton />,
  parameters: {
    docs: {
      description: {
        story:
          'Skeleton loading state for the Bitcoin node card. Shows shimmer animation while data loads.'
      }
    }
  }
};

// ===== RELAYS SKELETON =====

export const RelaysSection: StoryObj = {
  render: () => <RelaysSkeleton />,
  parameters: {
    docs: {
      description: {
        story: 'Skeleton for the connected relays section.'
      }
    }
  }
};

// ===== ACTIVITY LOG SKELETON =====

export const ActivityLog: StoryObj = {
  render: () => <ActivityLogSkeleton />,
  parameters: {
    docs: {
      description: {
        story: 'Skeleton for the activity log section showing placeholder entries.'
      }
    }
  }
};

// ===== RECONNECTING INDICATOR =====

export const ReconnectingEarly: StoryObj = {
  render: () => <ReconnectingIndicator attempt={1} maxAttempts={8} nextRetryMs={2000} />,
  parameters: {
    docs: {
      description: {
        story: 'Early reconnection attempt with countdown to next retry.'
      }
    }
  }
};

export const ReconnectingMidway: StoryObj = {
  render: () => <ReconnectingIndicator attempt={4} maxAttempts={8} nextRetryMs={8000} />,
  parameters: {
    docs: {
      description: {
        story: 'Midway through reconnection attempts.'
      }
    }
  }
};

export const ReconnectingFinal: StoryObj = {
  render: () => <ReconnectingIndicator attempt={7} maxAttempts={8} nextRetryMs={30000} />,
  parameters: {
    docs: {
      description: {
        story: 'Final reconnection attempts before going offline.'
      }
    }
  }
};

// ===== STALE DATA INDICATOR =====

export const StaleDataRecent: StoryObj = {
  render: () => (
    <StaleDataIndicator
      lastUpdateMs={Date.now() - 5 * 60 * 1000}
      onRetry={() => alert('Retry clicked')}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Stale data warning for recently outdated data (5 minutes ago).'
      }
    }
  }
};

export const StaleDataOld: StoryObj = {
  render: () => (
    <StaleDataIndicator
      lastUpdateMs={Date.now() - 2 * 60 * 60 * 1000}
      onRetry={() => alert('Retry clicked')}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Stale data warning for significantly outdated data (2 hours ago).'
      }
    }
  }
};

export const StaleDataNoRetry: StoryObj = {
  render: () => <StaleDataIndicator lastUpdateMs={Date.now() - 30 * 60 * 1000} />,
  parameters: {
    docs: {
      description: {
        story: 'Stale data indicator without retry button.'
      }
    }
  }
};

// ===== FULL SIDEBAR SKELETON =====

export const FullSidebarLoading: StoryObj = {
  render: () => <TelemetrySidebarSkeleton />,
  decorators: [
    (Story) => (
      <div
        style={{ width: '280px', height: '600px', background: 'var(--ns-color-surface-default)' }}
      >
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Complete sidebar skeleton during initial page load.'
      }
    }
  }
};

// ===== PARTIAL LOADING STATES =====

export const PartialLoadingNodeOnly: StoryObj = {
  render: () => (
    <TelemetrySidebarSkeleton
      sectionStates={{
        node: 'loading',
        relays: 'loaded',
        log: 'loaded'
      }}
      sections={{
        relays: (
          <div className="telemetry-relays">
            <div className="telemetry-relays-title">
              Connected Relays
              <span className="telemetry-relay-count">3</span>
            </div>
            <div className="telemetry-relays-list">
              <div className="telemetry-relay-item">
                <div className="telemetry-relay-dot telemetry-relay-dot--connected" />
                relay.damus.io
              </div>
              <div className="telemetry-relay-item">
                <div className="telemetry-relay-dot telemetry-relay-dot--connected" />
                nos.lol
              </div>
              <div className="telemetry-relay-item">
                <div className="telemetry-relay-dot telemetry-relay-dot--connected" />
                relay.nostr.band
              </div>
            </div>
          </div>
        ),
        log: (
          <div className="telemetry-log">
            <div className="telemetry-log-entry is-info">
              <span className="telemetry-log-icon">ℹ️</span>
              <span className="telemetry-log-time">12:34:56</span>
              <span className="telemetry-log-message">Connected to relay</span>
            </div>
          </div>
        )
      }}
    />
  ),
  decorators: [
    (Story) => (
      <div
        style={{ width: '280px', height: '600px', background: 'var(--ns-color-surface-default)' }}
      >
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Partial loading: Node section still loading while relays and log have loaded.'
      }
    }
  }
};

export const PartialLoadingRelaysOnly: StoryObj = {
  render: () => (
    <TelemetrySidebarSkeleton
      sectionStates={{
        node: 'loaded',
        relays: 'loading',
        log: 'loaded'
      }}
      sections={{
        node: (
          <BitcoinNodeCard
            info={{
              network: 'mainnet',
              configuredNetwork: 'mainnet',
              source: 'bitcoind',
              height: 825000,
              time: Math.floor(Date.now() / 1000) - 120,
              connections: 12,
              verificationProgress: 0.9999,
              version: '26.0.0'
            }}
          />
        ),
        log: (
          <div className="telemetry-log">
            <div className="telemetry-log-entry is-info">
              <span className="telemetry-log-icon">🧱</span>
              <span className="telemetry-log-time">12:34:56</span>
              <span className="telemetry-log-message">New Block: 825000</span>
            </div>
          </div>
        )
      }}
    />
  ),
  decorators: [
    (Story) => (
      <div
        style={{ width: '280px', height: '600px', background: 'var(--ns-color-surface-default)' }}
      >
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Partial loading: Relays section still loading.'
      }
    }
  }
};

// ===== ERROR STATES =====

export const SectionError: StoryObj = {
  render: () => (
    <TelemetrySidebarSkeleton
      sectionStates={{
        node: 'error',
        relays: 'loaded',
        log: 'loaded'
      }}
      sections={{
        relays: (
          <div className="telemetry-relays">
            <div className="telemetry-relays-title">
              Connected Relays
              <span className="telemetry-relay-count">0</span>
            </div>
            <div className="telemetry-relays-empty">No relays connected</div>
          </div>
        ),
        log: (
          <div className="telemetry-log">
            <div className="telemetry-log-entry is-error">
              <span className="telemetry-log-icon">❌</span>
              <span className="telemetry-log-time">12:34:56</span>
              <span className="telemetry-log-message">Failed to connect to node</span>
            </div>
          </div>
        )
      }}
    />
  ),
  decorators: [
    (Story) => (
      <div
        style={{ width: '280px', height: '600px', background: 'var(--ns-color-surface-default)' }}
      >
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Node section failed to load, showing error state.'
      }
    }
  }
};

// ===== COMBINED STATES =====

export const ReconnectingWithStaleData: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ReconnectingIndicator attempt={3} maxAttempts={8} nextRetryMs={4000} />
      <StaleDataIndicator
        lastUpdateMs={Date.now() - 3 * 60 * 1000}
        onRetry={() => alert('Retry clicked')}
      />
      <BitcoinNodeCard
        info={{
          network: 'mainnet',
          configuredNetwork: 'mainnet',
          source: 'bitcoind',
          height: 825000,
          time: Math.floor(Date.now() / 1000) - 180,
          connections: 12,
          verificationProgress: 0.9999,
          version: '26.0.0',
          telemetryError: 'WebSocket connection lost. Showing cached data.'
        }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Combined state: reconnecting while showing stale data with warning.'
      }
    }
  }
};

// ===== ACCESSIBILITY: REDUCED MOTION =====

export const ReducedMotion: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--ns-color-text-muted)' }}>
        Enable &ldquo;Reduce motion&rdquo; in your OS accessibility settings to see the non-animated
        version.
      </p>
      <BitcoinNodeCardSkeleton />
      <ReconnectingIndicator attempt={2} maxAttempts={8} nextRetryMs={3000} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Skeleton and reconnecting states respect prefers-reduced-motion. Animations are replaced with subtle opacity changes.'
      }
    }
  }
};
