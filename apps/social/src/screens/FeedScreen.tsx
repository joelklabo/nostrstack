import { PostEditor, useAuth, useFeed, useNostrstackConfig } from '@nostrstack/react';
import { Alert, PostSkeleton } from '@nostrstack/ui';
import type { Event } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useContactList } from '../hooks/useContactList';
import { useMuteList } from '../hooks/useMuteList';
import { usePostNavigation } from '../hooks/usePostNavigation';
import { useRelays } from '../hooks/useRelays';
import { filterSpam } from '../nostr/spamFilter';
import { FindFriendCard } from '../ui/FindFriendCard';
import { NewPostsIndicator } from '../ui/NewPostsIndicator';
import { NostrEventCard } from '../ui/NostrEventCard';
import { SupportCard } from '../ui/SupportCard';
import { VirtualizedList } from '../ui/VirtualizedList';
import { resolveGalleryApiBase, resolveRuntimeApiBase } from '../utils/api-base';
import { estimatePostRowHeight } from '../utils/feed-layout';
import { navigateTo } from '../utils/navigation';
import { buildVirtualizedCacheKey } from '../utils/virtualized-cache';

interface FeedScreenProps {
  isImmersive?: boolean;
}

export function FeedScreen({ isImmersive }: FeedScreenProps) {
  const FEED_SCROLL_CONTAINER = '.feed-container';
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { isMuted } = useMuteList();
  const { contacts, loading: contactsLoading } = useContactList();
  const { pubkey } = useAuth();
  const feedContainerRef = useRef<HTMLElement | null>(null);
  const cfg = useNostrstackConfig();
  const apiBase = resolveRuntimeApiBase(
    resolveGalleryApiBase({
      apiBase: cfg.apiBase,
      baseUrl: cfg.baseUrl,
      apiBaseConfig: cfg.apiBaseConfig
    }).baseUrl
  );

  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  const [spamFilterEnabled, setSpamFilterEnabled] = useState(false);

  const getFeedContainer = useCallback(() => {
    if (typeof document === 'undefined') return null;
    if (feedContainerRef.current) return feedContainerRef.current;
    feedContainerRef.current = document.querySelector<HTMLElement>(FEED_SCROLL_CONTAINER);
    return feedContainerRef.current;
  }, []);

  const getFeedScrollTop = useCallback(() => {
    const container = getFeedContainer();
    return container ? container.scrollTop : typeof window !== 'undefined' ? window.scrollY : 0;
  }, [getFeedContainer]);

  const scrollFeedToTop = useCallback(() => {
    const container = getFeedContainer();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (container) {
      container.scrollTo({ top: 0, behavior });
      return;
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior });
    }
  }, [getFeedContainer]);

  // Keyboard navigation for posts
  usePostNavigation({ enabled: true, scrollContainer: FEED_SCROLL_CONTAINER });

  // Track new posts for indicator
  const [newPosts, setNewPosts] = useState<Array<{ pubkey: string; picture?: string }>>([]);
  const lastSeenPostId = useRef<string | null>(null);
  const isScrolledDown = useRef(false);

  // Track scroll position to know when to show indicator
  useEffect(() => {
    const handleScroll = () => {
      isScrolledDown.current = getFeedScrollTop() > 200;
    };
    const container = getFeedContainer();
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [getFeedScrollTop, getFeedContainer]);

  // Feed mode: 'all' shows all posts, 'following' shows only from contacts, 'trending' shows recent popular
  const [feedMode, setFeedMode] = useState<'all' | 'following' | 'trending'>(() => {
    if (typeof window === 'undefined') return 'all';
    const saved = localStorage.getItem('nostrstack.feedMode');
    if (saved === 'following' || saved === 'trending') return saved;
    return 'all';
  });

  // Sort mode: 'latest' shows newest first, 'chronological' shows oldest first
  const [sortMode, setSortMode] = useState<'latest' | 'chronological'>(() => {
    if (typeof window === 'undefined') return 'latest';
    const saved = localStorage.getItem('nostrstack.sortMode');
    return saved === 'chronological' ? 'chronological' : 'latest';
  });

  // Persist feed mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nostrstack.feedMode', feedMode);
    }
  }, [feedMode]);

  // Persist sort mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nostrstack.sortMode', sortMode);
    }
  }, [sortMode]);

  // Determine feed parameters
  const isFollowingMode = feedMode === 'following';
  const isTrendingMode = feedMode === 'trending';
  const canFetchFollowing = isFollowingMode && !contactsLoading && contacts.length > 0;
  const shouldFetch = !relaysLoading && (!isFollowingMode || canFetchFollowing);

  // Calculate 'since' for trending mode - last 4 hours
  const trendingSince = useMemo(() => {
    if (!isTrendingMode) return undefined;
    return Math.floor(Date.now() / 1000) - 4 * 60 * 60; // 4 hours ago
  }, [isTrendingMode]);

  const {
    events: posts,
    loading: feedLoading,
    hasMore,
    loadMore,
    error: feedError
  } = useFeed({
    enabled: shouldFetch,
    relays: relayList,
    kinds: [1],
    authors: isFollowingMode ? contacts : undefined,
    since: trendingSince,
    limit: 20
  });

  const isLoadingFeed = relaysLoading || (feedLoading && posts.length === 0);
  const hasNoPosts = posts.length === 0 && !feedLoading;

  // Memoize filtered posts with safety checks and sorting
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    try {
      const filtered = posts.filter((p) => {
        if (!p || !p.pubkey) return false;
        try {
          return !isMuted(p.pubkey);
        } catch {
          return true; // Don't crash if mute check fails
        }
      });
      const result = spamFilterEnabled ? filterSpam(filtered) : filtered;
      const seen = new Set<string>();
      const unique = result.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      // Sort posts based on sort mode - use spread to avoid mutating original array
      if (sortMode === 'latest') {
        return [...unique].sort((a, b) => b.created_at - a.created_at);
      }
      return unique; // chronological - return as-is from relay
    } catch (e) {
      console.error('Filter error', e);
      return posts;
    }
  }, [posts, isMuted, spamFilterEnabled, sortMode]);

  // Detect new posts when scrolled down
  useEffect(() => {
    if (!filteredPosts.length) return;

    const firstPost = filteredPosts[0];
    if (!firstPost) return;

    // Initialize last seen post
    if (!lastSeenPostId.current) {
      lastSeenPostId.current = firstPost.id;
      return;
    }

    // Check if there are new posts
    if (firstPost.id !== lastSeenPostId.current && isScrolledDown.current) {
      // Find new posts that came before our last seen
      const newPostsFound: Array<{ pubkey: string; picture?: string }> = [];
      for (const post of filteredPosts) {
        if (post.id === lastSeenPostId.current) break;
        newPostsFound.push({ pubkey: post.pubkey });
      }
      if (newPostsFound.length > 0) {
        setNewPosts((prev) => {
          // Deduplicate by pubkey
          const existing = new Set(prev.map((p) => p.pubkey));
          const additions = newPostsFound.filter((p) => !existing.has(p.pubkey));
          return [...additions, ...prev].slice(0, 10);
        });
      }
    } else if (!isScrolledDown.current) {
      // Clear new posts indicator when at top
      setNewPosts([]);
      lastSeenPostId.current = firstPost.id;
    }
  }, [filteredPosts]);

  const handleScrollToTop = useCallback(() => {
    scrollFeedToTop();
    setNewPosts([]);
    if (filteredPosts[0]) {
      lastSeenPostId.current = filteredPosts[0].id;
    }
  }, [filteredPosts, scrollFeedToTop]);

  const handleOpenThread = useCallback((eventId: string) => {
    navigateTo(`/nostr/${eventId}`);
  }, []);

  // Render a single post item for the virtualized list
  const renderPostItem = useCallback(
    (post: Event, _index: number) => (
      <NostrEventCard
        event={post}
        apiBase={apiBase}
        enableRegtestPay={enableRegtestPay}
        onOpenThread={handleOpenThread}
      />
    ),
    [apiBase, enableRegtestPay, handleOpenThread]
  );

  const estimatePostHeight = useCallback(
    (index: number) => estimatePostRowHeight(filteredPosts[index]),
    [filteredPosts]
  );

  const feedRowHeightCacheKey = useMemo(() => {
    return buildVirtualizedCacheKey(
      'feed-screen-posts-v1',
      filteredPosts.length,
      filteredPosts.map((post) => post.id),
      {
        mode: sortMode,
        filter: spamFilterEnabled ? 'on' : 'off'
      }
    );
  }, [sortMode, spamFilterEnabled, filteredPosts]);

  // Extract key for each post
  const getPostKey = useCallback((post: Event) => post.id, []);

  // Render loading indicator for virtualized list
  const renderLoadingIndicator = useCallback(
    () => (
      <div className="feed-load-more">
        <button
          type="button"
          className="ns-btn ns-btn--primary feed-load-more__btn"
          onClick={loadMore}
          disabled={feedLoading}
        >
          {feedLoading ? 'Loading more...' : 'Load more posts'}
        </button>
      </div>
    ),
    [loadMore, feedLoading]
  );

  const renderContent = () => {
    if (isLoadingFeed) {
      return (
        <div
          className="feed-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading posts"
        >
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (hasNoPosts) {
      return (
        <div className="feed-empty" role="status" aria-live="polite">
          <div className="feed-empty__icon" aria-hidden="true">
            📝
          </div>
          <h3 className="feed-empty__title">No posts yet</h3>
          <p className="feed-empty__text">Be the first to share something with the network!</p>
          <button
            type="button"
            className="ns-btn ns-btn--primary"
            onClick={() => document.querySelector('textarea')?.focus()}
            aria-label="Write your first post"
          >
            Write your first post
          </button>
        </div>
      );
    }

    // Use virtualized rendering for large lists
    return (
      <VirtualizedList
        items={filteredPosts}
        getItemKey={getPostKey}
        renderItem={renderPostItem}
        rowHeight={estimatePostHeight}
        rowHeightCacheKey={feedRowHeightCacheKey}
        onLoadMore={hasMore ? loadMore : undefined}
        hasMore={hasMore}
        loading={feedLoading}
        renderLoadingIndicator={renderLoadingIndicator}
        ariaLabel="Feed posts"
      />
    );
  };

  return (
    <section className="feed-stream" aria-label="Live feed">
      <NewPostsIndicator newPosts={newPosts} onScrollToTop={handleScrollToTop} />

      <header className="feed-header" aria-hidden={isImmersive ? 'true' : undefined}>
        <h2 className="feed-title">
          Live Feed
          {!relaysLoading && (
            <span
              className="feed-relay-status"
              title={`${relayList.length} relay${relayList.length !== 1 ? 's' : ''} connected`}
              aria-label={`${relayList.length} relays connected`}
            >
              <span
                className={`feed-relay-dot ${relayList.length > 0 ? 'feed-relay-dot--online' : 'feed-relay-dot--offline'}`}
                aria-hidden="true"
              />
              {relayList.length}
            </span>
          )}
        </h2>
        <div className="feed-header__actions" role="group" aria-label="Feed filters">
          <button
            type="button"
            className={`ns-btn ns-btn--sm ${feedMode === 'all' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setFeedMode('all')}
            aria-pressed={feedMode === 'all'}
            aria-label="Show all posts"
          >
            All
          </button>
          <button
            type="button"
            className={`ns-btn ns-btn--sm ${feedMode === 'following' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => pubkey && setFeedMode('following')}
            disabled={!pubkey}
            aria-pressed={feedMode === 'following'}
            aria-label="Show posts from people you follow"
          >
            Following
          </button>
          <button
            type="button"
            className={`ns-btn ns-btn--sm ${feedMode === 'trending' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setFeedMode('trending')}
            aria-pressed={feedMode === 'trending'}
            aria-label="Show trending posts from last 4 hours"
          >
            Trending 4h
          </button>
          <button
            type="button"
            className="ns-btn ns-btn--sm ns-btn--ghost"
            onClick={() => navigateTo('/search')}
            aria-label="Search posts and profiles"
          >
            <span aria-hidden="true">🔍</span> Search
          </button>
          <button
            type="button"
            className={`ns-btn ns-btn--sm ${sortMode === 'latest' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setSortMode(sortMode === 'latest' ? 'chronological' : 'latest')}
            aria-pressed={sortMode === 'latest'}
            aria-label={
              sortMode === 'latest'
                ? 'Showing latest posts, click for chronological'
                : 'Showing chronological, click for latest'
            }
          >
            {sortMode === 'latest' ? 'Latest' : 'Chronological'}
          </button>
          <button
            type="button"
            className={`ns-btn ns-btn--sm ${spamFilterEnabled ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
            title="Toggle Spam Filter"
            aria-pressed={spamFilterEnabled}
            aria-label={
              spamFilterEnabled
                ? 'Spam filter enabled, click to disable'
                : 'Spam filter disabled, click to enable'
            }
          >
            <span aria-hidden="true">🛡️</span> {spamFilterEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </header>

      <div className="feed-editor" aria-hidden={isImmersive ? 'true' : undefined}>
        <PostEditor />
      </div>

      <FindFriendCard onClick={() => navigateTo('/search')} />

      <SupportCard />

      {feedError && (
        <Alert tone="danger" style={{ marginBottom: '1.5rem' }}>
          Failed to load feed: {feedError}
        </Alert>
      )}

      {renderContent()}
    </section>
  );
}
