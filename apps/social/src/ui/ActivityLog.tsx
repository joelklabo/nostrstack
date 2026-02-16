import './activity-log.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { VirtualizedList } from './VirtualizedList';

// ===== Types =====

export type ActivityEventType =
  | 'block'
  | 'payment_received'
  | 'payment_sent'
  | 'connection'
  | 'disconnection'
  | 'error'
  | 'warning'
  | 'info';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: number;
  title: string;
  description?: string;
  metadata?: Record<string, string | number>;
  isNew?: boolean;
}

interface ActivityLogProps {
  /** Array of activity events to display */
  events: ActivityEvent[];
  /** Maximum number of events to display (for virtualization) */
  maxEvents?: number;
  /** Callback when an event is clicked */
  onEventClick?: (event: ActivityEvent) => void;
  /** Callback when user wants to load more events */
  onLoadMore?: () => void;
  /** Whether more events are available */
  hasMore?: boolean;
  /** Height of the log container */
  height?: number;
  /** Mark events older than this timestamp as read */
  readTimestamp?: number;
}

// ===== Utility Functions =====

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const delta = Math.floor((now - timestamp) / 1000);

  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function getEventIcon(type: ActivityEventType): { icon: string; label: string } {
  switch (type) {
    case 'block':
      return { icon: 'block', label: 'New block' };
    case 'payment_received':
      return { icon: 'payment-in', label: 'Payment received' };
    case 'payment_sent':
      return { icon: 'payment-out', label: 'Payment sent' };
    case 'connection':
      return { icon: 'connect', label: 'Connected' };
    case 'disconnection':
      return { icon: 'disconnect', label: 'Disconnected' };
    case 'error':
      return { icon: 'error', label: 'Error' };
    case 'warning':
      return { icon: 'warning', label: 'Warning' };
    case 'info':
    default:
      return { icon: 'info', label: 'Info' };
  }
}

// ===== Icon Components =====

function BlockIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function PaymentInIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M17 7l-5-5-5 5" />
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}

function PaymentOutIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22V2M7 17l5 5 5-5" />
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15,3 21,3 21,9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="ns-activity-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ActivityIcon({ type }: { type: ActivityEventType }) {
  const iconMap: Record<ActivityEventType, React.ReactNode> = {
    block: <BlockIcon />,
    payment_received: <PaymentInIcon />,
    payment_sent: <PaymentOutIcon />,
    connection: <ConnectIcon />,
    disconnection: <DisconnectIcon />,
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    info: <InfoIcon />
  };

  return iconMap[type] || <InfoIcon />;
}

// ===== Celebration Particles for New Blocks =====

function BlockCelebration({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="ns-activity-celebration" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <span
          key={i}
          className="ns-activity-particle"
          style={{ '--particle-index': i } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ===== Activity Item Component =====

interface ActivityItemProps {
  event: ActivityEvent;
  isUnread: boolean;
  onClick?: () => void;
  animationDelay?: number;
}

function ActivityItem({ event, isUnread, onClick, animationDelay = 0 }: ActivityItemProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(event.timestamp));
  const itemRef = useRef<HTMLDivElement | HTMLButtonElement>(null);
  const { label } = getEventIcon(event.type);

  // Update relative time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(event.timestamp));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [event.timestamp]);

  // Trigger celebration animation for new blocks
  useEffect(() => {
    if (event.type === 'block' && event.isNew) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [event.type, event.isNew]);

  const isClickable = Boolean(onClick);
  const className = `ns-activity-item ns-activity-item--${event.type} ${isUnread ? 'is-unread' : ''} ${event.isNew ? 'is-new' : ''}`;
  const style = { '--animation-delay': `${animationDelay}ms` } as React.CSSProperties;
  const ariaLabel = `${label}: ${event.title}, ${relativeTime}`;

  const content = (
    <>
      <BlockCelebration isVisible={showCelebration} />

      <div className="ns-activity-icon" data-type={event.type}>
        <ActivityIcon type={event.type} />
        {isUnread && <span className="ns-activity-unread-dot" aria-hidden="true" />}
      </div>

      <div className="ns-activity-content">
        <div className="ns-activity-header">
          <span className="ns-activity-title">{event.title}</span>
          <time className="ns-activity-time" dateTime={new Date(event.timestamp).toISOString()}>
            {relativeTime}
          </time>
        </div>
        {event.description && <p className="ns-activity-desc">{event.description}</p>}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="ns-activity-meta">
            {Object.entries(event.metadata).map(([key, value]) => (
              <span key={key} className="ns-activity-meta-item">
                <span className="ns-activity-meta-key">{key}:</span>
                <span className="ns-activity-meta-value">{String(value)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Render as button when clickable for proper accessibility
  if (isClickable) {
    return (
      <button
        ref={itemRef as React.RefObject<HTMLButtonElement>}
        type="button"
        className={className}
        style={style}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      ref={itemRef as React.RefObject<HTMLDivElement | null>}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {content}
    </div>
  );
}

// ===== Main Activity Log Component =====

export function ActivityLog({
  events,
  maxEvents = 100,
  onEventClick,
  onLoadMore,
  hasMore,
  height,
  readTimestamp
}: ActivityLogProps) {
  const [localReadTimestamp, setLocalReadTimestamp] = useState<number>(
    () => readTimestamp ?? Date.now()
  );
  const listRef = useRef<HTMLDivElement>(null);

  // Track which events are unread
  const effectiveReadTimestamp = readTimestamp ?? localReadTimestamp;

  // Sort events by timestamp (newest first) and limit
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, maxEvents);
  }, [events, maxEvents]);

  // Count unread events
  const unreadCount = useMemo(() => {
    return sortedEvents.filter((e) => e.timestamp > effectiveReadTimestamp).length;
  }, [sortedEvents, effectiveReadTimestamp]);

  // Mark all as read
  const markAllRead = useCallback(() => {
    setLocalReadTimestamp(Date.now());
  }, []);

  // Render individual activity item
  const renderItem = useCallback(
    (event: ActivityEvent, index: number) => {
      const isUnread = event.timestamp > effectiveReadTimestamp;
      return (
        <ActivityItem
          event={event}
          isUnread={isUnread}
          onClick={onEventClick ? () => onEventClick(event) : undefined}
          animationDelay={index * 30} // Stagger animation
        />
      );
    },
    [effectiveReadTimestamp, onEventClick]
  );

  // Key extractor
  const getItemKey = useCallback((event: ActivityEvent) => event.id, []);

  // Loading indicator
  const renderLoadingIndicator = useCallback(
    () => (
      <div className="ns-activity-loading">
        <div className="ns-activity-loading-spinner" />
        <span>Loading more events...</span>
      </div>
    ),
    []
  );

  return (
    <div className="ns-activity-log" ref={listRef}>
      <div className="ns-activity-log-header">
        <h3 className="ns-activity-log-title">
          Activity Log
          {unreadCount > 0 && (
            <span className="ns-activity-unread-badge" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            type="button"
            className="ns-activity-mark-read"
            onClick={markAllRead}
            aria-label="Mark all as read"
          >
            Mark all read
          </button>
        )}
      </div>

      {sortedEvents.length === 0 ? (
        <div className="ns-activity-empty" role="status">
          <InfoIcon />
          <p>No activity yet</p>
        </div>
      ) : (
        <VirtualizedList
          items={sortedEvents}
          rowHeightCacheKey="activity-log-v1"
          getItemKey={getItemKey}
          renderItem={renderItem}
          height={height}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          renderLoadingIndicator={renderLoadingIndicator}
          ariaLabel="Activity log"
          role="log"
          itemRole="article"
          ariaLive="polite"
          ariaRelevant="additions"
        />
      )}
    </div>
  );
}

// ===== Demo/Story Helper: Generate Sample Events =====

export function generateSampleEvents(count: number): ActivityEvent[] {
  const types: ActivityEventType[] = [
    'block',
    'payment_received',
    'payment_sent',
    'connection',
    'disconnection',
    'error',
    'warning',
    'info'
  ];

  const titles: Record<ActivityEventType, string[]> = {
    block: ['New Block #', 'Block Mined #'],
    payment_received: ['Received 1,000 sats', 'Received 21,000 sats', 'Tip received'],
    payment_sent: ['Sent 500 sats', 'Zap sent', 'Payment completed'],
    connection: ['Connected to relay', 'Peer connected', 'WebSocket opened'],
    disconnection: ['Relay disconnected', 'Peer dropped', 'Connection lost'],
    error: ['Payment failed', 'Relay error', 'Timeout exceeded'],
    warning: ['Low balance', 'Slow connection', 'Deprecated API'],
    info: ['Sync complete', 'Settings updated', 'Cache cleared']
  };

  const events: ActivityEvent[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const titleOptions = titles[type];
    let title = titleOptions[Math.floor(Math.random() * titleOptions.length)];

    // Add block number for block events
    if (type === 'block') {
      title = `${title}${800000 + Math.floor(Math.random() * 1000)}`;
    }

    events.push({
      id: `event-${i}-${Date.now()}`,
      type,
      timestamp: now - i * 60000 * Math.random() * 10, // Random times in the past
      title,
      description: Math.random() > 0.5 ? 'Additional details about this event.' : undefined,
      metadata:
        Math.random() > 0.7
          ? {
              txid: `abc${Math.random().toString(36).slice(2, 8)}`,
              confirmations: Math.floor(Math.random() * 6)
            }
          : undefined,
      isNew: i < 3 // First 3 events are "new"
    });
  }

  return events;
}
