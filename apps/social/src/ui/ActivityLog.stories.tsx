import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useEffect, useState } from 'react';

import {
  type ActivityEvent,
  type ActivityEventType,
  ActivityLog,
  generateSampleEvents
} from './ActivityLog';

const meta: Meta<typeof ActivityLog> = {
  title: 'Components/ActivityLog',
  component: ActivityLog,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Activity Log component for Bitcoin telemetry with micro-interactions.

## Features
- **Virtualized list** for performance with 100+ items
- **Entry animations** with slide-in from right and stagger delay
- **Distinct icons** per event type (block, payment, connection, error, etc.)
- **Relative timestamps** that update automatically ("2m ago")
- **Unread indicator dots** with pulse animation
- **Block celebration** micro-animation with particles
- **Reduced motion support** for accessibility

## Event Types
- \`block\` - New Bitcoin blocks (with celebration animation)
- \`payment_received\` - Incoming payments
- \`payment_sent\` - Outgoing payments
- \`connection\` - Connection events
- \`disconnection\` - Disconnection events
- \`error\` - Error messages
- \`warning\` - Warning messages
- \`info\` - General information
        `
      }
    }
  },
  argTypes: {
    events: {
      control: false,
      description: 'Array of activity events to display'
    },
    maxEvents: {
      control: { type: 'number', min: 10, max: 500, step: 10 },
      description: 'Maximum number of events to display'
    },
    height: {
      control: { type: 'number', min: 200, max: 800, step: 50 },
      description: 'Height of the log container'
    },
    hasMore: {
      control: 'boolean',
      description: 'Whether more events are available to load'
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof ActivityLog>;

// Basic story with sample events
export const Default: Story = {
  args: {
    events: generateSampleEvents(20),
    maxEvents: 100,
    height: 500
  }
};

// Empty state
export const Empty: Story = {
  args: {
    events: [],
    height: 300
  }
};

// With many unread items
export const ManyUnread: Story = {
  args: {
    events: generateSampleEvents(30),
    maxEvents: 100,
    height: 500,
    readTimestamp: Date.now() - 1000 * 60 * 60 // 1 hour ago
  }
};

// Large list for virtualization testing
export const LargeList: Story = {
  args: {
    events: generateSampleEvents(200),
    maxEvents: 200,
    height: 600,
    hasMore: true
  }
};

// Only block events
export const BlocksOnly: Story = {
  args: {
    events: Array.from({ length: 15 }, (_, i) => ({
      id: `block-${i}`,
      type: 'block' as ActivityEventType,
      timestamp: Date.now() - i * 600000, // ~10 min apart
      title: `New Block #${800000 + 15 - i}`,
      description: `${Math.floor(Math.random() * 3000 + 1000)} transactions`,
      metadata: {
        size: `${(Math.random() * 1.5 + 0.5).toFixed(2)} MB`,
        fees: `${(Math.random() * 0.5 + 0.1).toFixed(4)} BTC`
      },
      isNew: i < 2
    })),
    height: 500
  }
};

// Only payment events
export const PaymentsOnly: Story = {
  args: {
    events: Array.from({ length: 20 }, (_, i) => ({
      id: `payment-${i}`,
      type: (i % 2 === 0 ? 'payment_received' : 'payment_sent') as ActivityEventType,
      timestamp: Date.now() - i * 120000,
      title:
        i % 2 === 0
          ? `Received ${(Math.random() * 10000 + 100).toFixed(0)} sats`
          : `Sent ${(Math.random() * 5000 + 50).toFixed(0)} sats`,
      description: i % 3 === 0 ? 'Lightning payment' : undefined,
      isNew: i < 3
    })),
    height: 500
  }
};

// Mixed error and warning events
export const ErrorsAndWarnings: Story = {
  args: {
    events: [
      {
        id: 'error-1',
        type: 'error',
        timestamp: Date.now() - 60000,
        title: 'Payment failed',
        description: 'Insufficient channel balance',
        isNew: true
      },
      {
        id: 'warning-1',
        type: 'warning',
        timestamp: Date.now() - 120000,
        title: 'Low balance warning',
        description: 'Channel capacity below 10%',
        isNew: true
      },
      {
        id: 'error-2',
        type: 'error',
        timestamp: Date.now() - 180000,
        title: 'Connection timeout',
        description: 'Failed to reach relay wss://relay.example.com'
      },
      {
        id: 'warning-2',
        type: 'warning',
        timestamp: Date.now() - 300000,
        title: 'Deprecated API',
        description: 'NIP-04 encryption will be removed in next version'
      },
      {
        id: 'info-1',
        type: 'info',
        timestamp: Date.now() - 600000,
        title: 'System recovered',
        description: 'All services back online'
      }
    ],
    height: 400
  }
};

// Interactive story with live updates
export const LiveUpdates: Story = {
  render: function LiveUpdatesStory() {
    const [events, setEvents] = useState<ActivityEvent[]>(() => generateSampleEvents(10));

    const addRandomEvent = useCallback(() => {
      const types: ActivityEventType[] = [
        'block',
        'payment_received',
        'payment_sent',
        'connection',
        'info'
      ];
      const type = types[Math.floor(Math.random() * types.length)];

      let title = '';
      switch (type) {
        case 'block':
          title = `New Block #${800000 + Math.floor(Math.random() * 1000)}`;
          break;
        case 'payment_received':
          title = `Received ${(Math.random() * 10000 + 100).toFixed(0)} sats`;
          break;
        case 'payment_sent':
          title = `Sent ${(Math.random() * 5000 + 50).toFixed(0)} sats`;
          break;
        case 'connection':
          title = 'Connected to relay';
          break;
        default:
          title = 'System event';
      }

      const newEvent: ActivityEvent = {
        id: `live-${Date.now()}`,
        type,
        timestamp: Date.now(),
        title,
        isNew: true
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
    }, []);

    // Auto-add events
    useEffect(() => {
      const interval = setInterval(addRandomEvent, 3000);
      return () => clearInterval(interval);
    }, [addRandomEvent]);

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={addRandomEvent}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Add Random Event
          </button>
          <button
            type="button"
            onClick={() => {
              const blockEvent: ActivityEvent = {
                id: `block-${Date.now()}`,
                type: 'block',
                timestamp: Date.now(),
                title: `New Block #${800000 + Math.floor(Math.random() * 1000)}`,
                description: `${Math.floor(Math.random() * 3000 + 1000)} transactions`,
                isNew: true
              };
              setEvents((prev) => [blockEvent, ...prev].slice(0, 50));
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--ns-color-bitcoin-default, #f7931a)',
              background: 'color-mix(in oklch, var(--ns-color-bitcoin-default, #f7931a) 8%, white)',
              color: 'var(--ns-color-bitcoin-default, #f7931a)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Add Block (with celebration)
          </button>
        </div>
        <ActivityLog
          events={events}
          maxEvents={50}
          height={500}
          readTimestamp={Date.now() - 60000}
        />
      </div>
    );
  }
};

// Clickable events with callback
export const Clickable: Story = {
  render: function ClickableStory() {
    const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
    const events = generateSampleEvents(15);

    return (
      <div>
        <ActivityLog events={events} height={400} onEventClick={setSelectedEvent} />
        {selectedEvent && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: '#f5f5f5',
              borderRadius: 8,
              fontSize: 14
            }}
          >
            <strong>Selected Event:</strong>
            <pre style={{ margin: '8px 0 0', fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
};
