import type { AriaAttributes, AriaRole, CSSProperties, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, type RowComponentProps, useDynamicRowHeight } from 'react-window';

// Default estimated height for items before measurement
const DEFAULT_ITEM_HEIGHT = 200;
// Extra rows above/below viewport for smooth scrolling
const OVERSCAN_COUNT = 5;
const DEFAULT_CONTAINER_HEIGHT = 600;
const CONTAINER_BOTTOM_PADDING = 20;
const STABLE_HEIGHT_EPSILON = 1;

interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Unique key extractor for each item */
  getItemKey: (item: T, index: number) => string;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional height of the list container (defaults to window height minus offset) */
  height?: number;
  /** Width of the list (defaults to 100%) */
  width?: number | string;
  /** Called when user scrolls near the bottom */
  onLoadMore?: () => void;
  /** Whether more items are available to load */
  hasMore?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Render function for loading indicator at the bottom */
  renderLoadingIndicator?: () => React.ReactNode;
  /** Accessibility label for the list */
  ariaLabel?: string;
  /** Accessibility role for the list container */
  role?: AriaRole;
  /** Accessibility role for each item wrapper */
  itemRole?: AriaRole;
  /** Cache key used by dynamic row-height measurements */
  rowHeightCacheKey?: string;
  /** Optional fixed/heuristic row height for predictable virtualized sizing */
  rowHeight?: number | ((index: number, item: T | undefined) => number);
  /** Live region politeness for dynamic updates */
  ariaLive?: AriaAttributes['aria-live'];
  /** Live region relevance for dynamic updates */
  ariaRelevant?: AriaAttributes['aria-relevant'];
  /** Live region atomic setting */
  ariaAtomic?: AriaAttributes['aria-atomic'];
}

interface RowProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string;
  hasMore?: boolean;
  renderLoadingIndicator?: () => React.ReactNode;
  itemRole?: AriaRole;
}

// Row component that renders individual items
function RowComponent<T>({
  index,
  style,
  items,
  renderItem,
  getItemKey,
  hasMore,
  renderLoadingIndicator,
  itemRole
}: RowComponentProps<RowProps<T>>): ReactElement | null {
  // Check if this is the loading indicator row
  if (index >= items.length) {
    if (hasMore && renderLoadingIndicator) {
      return <div style={style}>{renderLoadingIndicator()}</div>;
    }
    return null;
  }

  const item = items[index];
  const itemKey = getItemKey(item, index);

  return (
    <div
      className="virtualized-row"
      style={{
        ...style,
        paddingBottom: 'var(--ns-space-4, 16px)',
        contain: 'layout',
        minHeight: 'var(--ns-event-card-min-height, 180px)',
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto var(--ns-event-card-min-height, 180px)'
      }}
      data-virtualized-item={itemKey}
      role={itemRole}
      aria-posinset={itemRole ? index + 1 : undefined}
      aria-setsize={itemRole ? items.length : undefined}
    >
      {renderItem(item, index)}
    </div>
  );
}

export function VirtualizedList<T>({
  items,
  getItemKey,
  renderItem,
  height: propHeight,
  width,
  onLoadMore,
  hasMore,
  loading,
  renderLoadingIndicator,
  ariaLabel,
  role = 'feed',
  itemRole,
  rowHeight,
  rowHeightCacheKey,
  ariaLive,
  ariaRelevant,
  ariaAtomic
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CONTAINER_HEIGHT;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return Math.max(0, viewportHeight - CONTAINER_BOTTOM_PADDING);
  });

  const resolvedRowHeightCacheKey = useMemo(() => {
    if (rowHeightCacheKey) {
      return rowHeightCacheKey;
    }

    const listContext = ariaLabel ?? 'virtualized-list';
    return `social-list-row-height-v1::${role ?? 'list'}::${itemRole ?? 'item'}::${listContext}`;
  }, [rowHeightCacheKey, role, itemRole, ariaLabel]);

  const resolveContainerHeight = useCallback((): number => {
    if (propHeight) return propHeight;
    if (typeof window === 'undefined') return DEFAULT_CONTAINER_HEIGHT;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const offset = containerRef.current?.getBoundingClientRect().top ?? 0;
    return Math.max(0, viewportHeight - offset - CONTAINER_BOTTOM_PADDING);
  }, [propHeight]);

  // Use dynamic row height from react-window v2
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ITEM_HEIGHT,
    key: resolvedRowHeightCacheKey
  });

  const resolvedRowHeight = useMemo(() => {
    if (typeof rowHeight === 'number') {
      return rowHeight;
    }

    if (typeof rowHeight === 'function') {
      return (index: number) => rowHeight(index, items[index]);
    }

    return dynamicRowHeight;
  }, [dynamicRowHeight, rowHeight, items]);

  // Update container height based on viewport and anchor changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flushHeightUpdate = () => {
      const nextHeight = resolveContainerHeight();
      setContainerHeight((previousHeight) => {
        if (Math.abs(previousHeight - nextHeight) <= STABLE_HEIGHT_EPSILON) {
          return previousHeight;
        }
        return nextHeight;
      });
    };

    const scheduleHeightUpdate = () => {
      if (resizeFrameRef.current !== null) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        flushHeightUpdate();
      });
    };

    if (propHeight) {
      flushHeightUpdate();
      return;
    }

    const container = containerRef.current;
    const ro =
      typeof ResizeObserver !== 'undefined' && container
        ? new ResizeObserver(() => {
            scheduleHeightUpdate();
          })
        : null;

    flushHeightUpdate();
    if (ro && container) {
      ro.observe(container);
    }
    window.addEventListener('resize', scheduleHeightUpdate, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleHeightUpdate, { passive: true });
    window.addEventListener('orientationchange', scheduleHeightUpdate);

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      window.removeEventListener('resize', scheduleHeightUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleHeightUpdate);
      window.removeEventListener('orientationchange', scheduleHeightUpdate);
      ro?.disconnect();
    };
  }, [resolveContainerHeight, propHeight]);

  // Handle scroll events for infinite loading
  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      // Only load more when near the bottom
      if (hasMore && !loading && onLoadMore) {
        const threshold = 5; // Load more when within 5 items of the end
        if (visibleRows.stopIndex >= items.length - threshold) {
          onLoadMore();
        }
      }
    },
    [hasMore, loading, onLoadMore, items.length]
  );

  // Row props passed to row component
  const resolvedItemRole =
    itemRole ?? (role === 'list' ? 'listitem' : role === 'feed' ? 'article' : undefined);

  const rowProps: RowProps<T> = {
    items,
    renderItem,
    getItemKey,
    hasMore,
    renderLoadingIndicator,
    itemRole: resolvedItemRole
  };

  // Total item count including potential loading indicator
  const rowCount = items.length + (hasMore && renderLoadingIndicator ? 1 : 0);

  // Style for the list container
  const listStyle: CSSProperties = {
    width: width ?? '100%',
    height: containerHeight
  };

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-live={ariaLive}
      aria-relevant={ariaRelevant}
      aria-atomic={ariaAtomic}
    >
      <List
        rowComponent={RowComponent as typeof RowComponent<T>}
        rowCount={rowCount}
        rowHeight={resolvedRowHeight}
        rowProps={rowProps}
        defaultHeight={containerHeight}
        overscanCount={OVERSCAN_COUNT}
        onRowsRendered={handleRowsRendered}
        style={listStyle}
      />
    </div>
  );
}
