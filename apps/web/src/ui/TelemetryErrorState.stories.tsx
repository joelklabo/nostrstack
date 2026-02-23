import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  TelemetryEmptyState,
  TelemetryErrorInline,
  TelemetryErrorState,
  type TelemetryErrorVariant
} from './TelemetryErrorState';

const meta = {
  title: 'UI/TelemetryErrorState',
  component: TelemetryErrorState,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '400px', padding: '1rem' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof TelemetryErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== NETWORK ERRORS =====

export const NetworkUnreachable: Story = {
  args: {
    variant: 'network-unreachable',
    onRetry: () => alert('Retrying...'),
    onSecondaryAction: () => alert('Checking connection settings...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when the device has no internet connection. This is a user-fixable error with clear guidance on what to check.'
      }
    }
  }
};

export const ApiDown: Story = {
  args: {
    variant: 'api-down',
    onRetry: () => alert('Retrying...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when the backend API is unavailable. This is a system error - the user is reassured that the team is working on it.'
      }
    }
  }
};

export const Timeout: Story = {
  args: {
    variant: 'timeout',
    onRetry: () => alert('Retrying...'),
    details: 'Request timed out after 30s'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when a request takes too long. Includes optional details field for debugging info.'
      }
    }
  }
};

// ===== DATA ERRORS =====

export const NoDataAvailable: Story = {
  args: {
    variant: 'no-data',
    onRetry: () => alert('Refreshing...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when no blockchain data is available yet, typically during initial sync or startup.'
      }
    }
  }
};

export const WebSocketDisconnected: Story = {
  args: {
    variant: 'websocket-disconnected',
    onRetry: () => alert('Reconnecting...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when the real-time WebSocket connection is lost. Data may be stale until reconnected.'
      }
    }
  }
};

// ===== ACCESS ERRORS =====

export const RateLimited: Story = {
  args: {
    variant: 'rate-limited',
    onRetry: () => alert('Retrying...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when too many requests have been made. User is advised to wait before retrying.'
      }
    }
  }
};

export const AuthRequired: Story = {
  args: {
    variant: 'auth-required',
    onRetry: () => alert('Opening sign in...'),
    onSecondaryAction: () => alert('Opening documentation...')
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shown when authentication is required to access telemetry data. Provides sign in and learn more options.'
      }
    }
  }
};

// ===== VARIANTS =====

export const CompactVariant: Story = {
  args: {
    variant: 'api-down',
    compact: true,
    onRetry: () => alert('Retrying...')
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact variant for use in smaller spaces or sidebars.'
      }
    }
  }
};

export const WithRetryInProgress: Story = {
  args: {
    variant: 'network-unreachable',
    onRetry: () => {},
    isRetrying: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state when a retry is in progress.'
      }
    }
  }
};

export const WithCustomMessages: Story = {
  args: {
    variant: 'api-down',
    title: 'Bitcoin Node Offline',
    message: 'Your local Bitcoin node is not responding. Check that bitcoind is running.',
    onRetry: () => alert('Retrying...')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates custom title and message overrides for specific contexts.'
      }
    }
  }
};

// ===== INLINE VARIANT =====

export const InlineErrors: StoryObj = {
  render: () => {
    const variants: TelemetryErrorVariant[] = [
      'network-unreachable',
      'api-down',
      'timeout',
      'no-data',
      'websocket-disconnected',
      'rate-limited',
      'auth-required'
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
        {variants.map((variant) => (
          <TelemetryErrorInline
            key={variant}
            variant={variant}
            onRetry={() => alert(`Retrying ${variant}...`)}
          />
        ))}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Inline error indicators for use within cards or compact spaces.'
      }
    }
  }
};

// ===== EMPTY STATE =====

export const EmptyStateDefault: StoryObj = {
  render: () => <TelemetryEmptyState onRefresh={() => alert('Refreshing...')} />,
  parameters: {
    docs: {
      description: {
        story: 'Empty state shown when waiting for blockchain data to become available.'
      }
    }
  }
};

export const EmptyStateWithProgress: StoryObj = {
  render: () => (
    <TelemetryEmptyState
      title="Syncing Blockchain"
      message="Your node is downloading and verifying the blockchain. This may take some time."
      showProgress
      progress={42.5}
      onRefresh={() => alert('Refreshing...')}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Empty state with sync progress indicator for Initial Block Download.'
      }
    }
  }
};

export const EmptyStateRefreshing: StoryObj = {
  render: () => <TelemetryEmptyState onRefresh={() => {}} isRefreshing />,
  parameters: {
    docs: {
      description: {
        story: 'Empty state showing refresh in progress.'
      }
    }
  }
};

// ===== INTERACTIVE DEMO =====

function InteractiveDemo() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<TelemetryErrorVariant | null>('network-unreachable');

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      // Simulate success 50% of the time
      if (Math.random() > 0.5) {
        setError(null);
      }
    }, 2000);
  };

  const simulateError = (variant: TelemetryErrorVariant) => {
    setError(variant);
  };

  if (!error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--ns-color-success-default)', marginBottom: '1rem' }}>
          Connection restored! Data is now available.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            className="ns-btn ns-btn--sm"
            onClick={() => simulateError('network-unreachable')}
          >
            Simulate Network Error
          </button>
          <button
            type="button"
            className="ns-btn ns-btn--sm"
            onClick={() => simulateError('api-down')}
          >
            Simulate API Down
          </button>
          <button
            type="button"
            className="ns-btn ns-btn--sm"
            onClick={() => simulateError('timeout')}
          >
            Simulate Timeout
          </button>
        </div>
      </div>
    );
  }

  return (
    <TelemetryErrorState
      variant={error}
      onRetry={handleRetry}
      isRetrying={isRetrying}
      onSecondaryAction={
        error === 'network-unreachable' || error === 'auth-required'
          ? () => alert('Secondary action')
          : undefined
      }
    />
  );
}

export const InteractiveRetry: StoryObj = {
  render: () => <InteractiveDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo showing the retry flow. Click "Try Again" to simulate a retry attempt that may succeed or fail.'
      }
    }
  }
};

// ===== DARK MODE PREVIEW =====

export const DarkModePreview: StoryObj = {
  render: () => (
    <div data-theme="dark" style={{ padding: '1rem', borderRadius: '8px' }}>
      <TelemetryErrorState variant="api-down" onRetry={() => alert('Retrying...')} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Error state appearance in dark mode.'
      }
    },
    backgrounds: { default: 'dark' }
  }
};

// ===== ALL VARIANTS =====

export const AllVariantsWeb: StoryObj = {
  render: () => {
    const variants: TelemetryErrorVariant[] = [
      'network-unreachable',
      'api-down',
      'timeout',
      'no-data',
      'websocket-disconnected',
      'rate-limited',
      'auth-required'
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
        {variants.map((variant) => (
          <div key={variant}>
            <h4
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--ns-color-text-muted)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}
            >
              {variant}
            </h4>
            <TelemetryErrorState variant={variant} onRetry={() => {}} />
          </div>
        ))}
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', maxHeight: '80vh', overflow: 'auto' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Web showing all error variants for comparison.'
      }
    }
  }
};
