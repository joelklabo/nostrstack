import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { List, type RowComponentProps, useDynamicRowHeight } from 'react-window';

// Default estimated height for items before measurement
const DEFAULT_ITEM_HEIGHT = 200;
// Extra rows above/below viewport for smooth scrolling
const OVERSCAN_COUNT = 5;

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
}

interface RowProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string;
  hasMore?: boolean;
  renderLoadingIndicator?: () => React.ReactNode;
}

// Row component that renders individual items
function RowComponent<T>({
  index,
  style,
  items,
  renderItem,
  getItemKey,
  hasMore,
  renderLoadingIndicator
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
    <div style={style} data-virtualized-item={itemKey}>
      {renderItem(item, index)}
    </div>
  );
}

export function VirtualizedList<T>({
  items,
  getItemKey,
  renderItem,
  height: propHeight,
  onLoadMore,
  hasMore,
  loading,
  renderLoadingIndicator,
  ariaLabel
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Use dynamic row height from react-window v2
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ITEM_HEIGHT,
    key: items.length // Re-calculate when items change
  });

  // Update container height based on window size
  useEffect(() => {
    const updateHeight = () => {
      if (propHeight) {
        setContainerHeight(propHeight);
      } else {
        // Default to window height minus some offset for headers
        const offset = containerRef.current?.getBoundingClientRect().top ?? 0;
        setContainerHeight(window.innerHeight - offset - 20);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [propHeight]);

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
  const rowProps: RowProps<T> = {
    items,
    renderItem,
    getItemKey,
    hasMore,
    renderLoadingIndicator
  };

  // Total item count including potential loading indicator
  const rowCount = items.length + (hasMore && renderLoadingIndicator ? 1 : 0);

  // Style for the list container
  const listStyle: CSSProperties = {
    width: '100%'
  };

  return (
    <div ref={containerRef} role="feed" aria-label={ariaLabel} aria-busy={loading}>
      <List
        rowComponent={RowComponent as typeof RowComponent<T>}
        rowCount={rowCount}
        rowHeight={dynamicRowHeight}
        rowProps={rowProps}
        defaultHeight={containerHeight}
        overscanCount={OVERSCAN_COUNT}
        onRowsRendered={handleRowsRendered}
        style={listStyle}
      />
    </div>
  );
}
