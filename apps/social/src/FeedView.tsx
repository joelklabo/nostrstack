import { PostEditor, useAuth, useFeed } from '@nostrstack/react';
import { Alert, PostSkeleton } from '@nostrstack/ui';
import type { Event } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useContactList } from './hooks/useContactList';
import { useMuteList } from './hooks/useMuteList';
import { usePostNavigation } from './hooks/usePostNavigation';
import { useRelays } from './hooks/useRelays';
import { useSimplePool } from './hooks/useSimplePool';
import { SEARCH_RELAYS } from './nostr/api';
import { filterSpam } from './nostr/spamFilter';
import { FindFriendCard } from './ui/FindFriendCard';
import { NewPostsIndicator } from './ui/NewPostsIndicator';
import { NostrEventCard } from './ui/NostrEventCard';
import { SupportCard } from './ui/SupportCard';
import { VirtualizedList } from './ui/VirtualizedList';
import { navigateTo } from './utils/navigation';

interface FeedViewProps {
  isImmersive?: boolean;
}

export function FeedView({ isImmersive }: FeedViewProps) {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { isMuted } = useMuteList();
  const { contacts, loading: contactsLoading } = useContactList();
  const { pubkey } = useAuth();
  const pool = useSimplePool();

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  const [spamFilterEnabled, setSpamFilterEnabled] = useState(false);

  // Keyboard navigation for posts
  usePostNavigation({ enabled: true });

  // Track new posts for indicator
  const [newPosts, setNewPosts] = useState<Array<{ pubkey: string; picture?: string }>>([]);
  const lastSeenPostId = useRef<string | null>(null);
  const feedContainerRef = useRef<HTMLElement>(null);
  const isScrolledDown = useRef(false);

  // Track scroll position to know when to show indicator
  useEffect(() => {
    const handleScroll = () => {
      isScrolledDown.current = window.scrollY > 200;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Feed mode: 'all' shows all posts, 'following' shows only from contacts, 'trending' shows recent popular posts
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
  const shouldFetch = !relaysLoading && (!isFollowingMode || canFetchFollowing) && !isTrendingMode;

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
    limit: 20
  });

  // Trending mode: fetch recent popular posts from search relays
  const [trendingPosts, setTrendingPosts] = useState<Event[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTrendingMode || relaysLoading) return;
    let cancelled = false;

    const fetchTrending = async () => {
      setTrendingLoading(true);
      setTrendingError(null);
      try {
        // Merge user relays with search relays for broader coverage
        const trendingRelays = [...new Set([...relayList, ...SEARCH_RELAYS])];
        // Fetch recent content from the last 4 hours
        const fourHoursAgo = Math.floor(Date.now() / 1000) - 4 * 60 * 60;
        const results = await pool.querySync(trendingRelays, {
          kinds: [1],
          since: fourHoursAgo,
          limit: 40
        });
        if (!cancelled) {
          // Deduplicate and sort by time
          const seen = new Set<string>();
          const unique = results.filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
          setTrendingPosts(unique.sort((a, b) => b.created_at - a.created_at));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Trending fetch failed', err);
          setTrendingError('Failed to load trending posts. Try again later.');
        }
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }
    };

    fetchTrending();
    return () => {
      cancelled = true;
    };
  }, [isTrendingMode, relaysLoading, relayList, pool]);

  // Choose the active posts based on mode
  const activePosts = isTrendingMode ? trendingPosts : posts;
  const activeLoading = isTrendingMode ? trendingLoading : feedLoading;
  const activeError = isTrendingMode ? trendingError : feedError;

  // Memoize filtered posts with safety checks and sorting
  const filteredPosts = useMemo(() => {
    if (!activePosts) return [];
    try {
      const filtered = activePosts.filter((p) => {
        if (!p || !p.pubkey) return false;
        try {
          return !isMuted(p.pubkey);
        } catch {
          return true; // Don't crash if mute check fails
        }
      });
      const result = spamFilterEnabled ? filterSpam(filtered) : filtered;
      // Sort posts based on sort mode - use spread to avoid mutating original array
      if (sortMode === 'latest') {
        return [...result].sort((a, b) => b.created_at - a.created_at);
      }
      return result; // chronological - return as-is from relay
    } catch (e) {
      console.error('Filter error', e);
      return activePosts;
    }
  }, [activePosts, isMuted, spamFilterEnabled, sortMode]);

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
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    setNewPosts([]);
    if (filteredPosts[0]) {
      lastSeenPostId.current = filteredPosts[0].id;
    }
  }, [filteredPosts]);

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
          disabled={activeLoading}
        >
          {activeLoading ? 'Loading more...' : 'Load more posts'}
        </button>
      </div>
    ),
    [loadMore, activeLoading]
  );

  const renderContent = () => {
    if (relaysLoading || (activeLoading && activePosts.length === 0)) {
      return (
        <div className="feed-loading" aria-busy="true" aria-label="Loading posts">
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (activePosts.length === 0 && !activeLoading) {
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
        onLoadMore={hasMore && !isTrendingMode ? loadMore : undefined}
        hasMore={hasMore && !isTrendingMode}
        loading={activeLoading}
        renderLoadingIndicator={renderLoadingIndicator}
        ariaLabel="Feed posts"
      />
    );
  };

  return (
    <section className="feed-stream" aria-label="Live feed" ref={feedContainerRef}>
      <NewPostsIndicator newPosts={newPosts} onScrollToTop={handleScrollToTop} />

      <header
        className="feed-header"
        inert={isImmersive || undefined}
        aria-hidden={isImmersive || undefined}
      >
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
            aria-label="Show trending posts from the last 4 hours"
          >
            Trending
          </button>
          <form
            className="feed-search-inline"
            role="search"
            aria-label="Quick search"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector('input');
              const q = input?.value?.trim();
              if (q) {
                navigateTo(`/search?q=${encodeURIComponent(q)}`);
              } else {
                navigateTo('/search');
              }
            }}
          >
            <input
              type="search"
              className="feed-search-input"
              placeholder="Search posts & profiles..."
              aria-label="Search posts and profiles"
              name="q"
            />
            <button
              type="submit"
              className="ns-btn ns-btn--sm ns-btn--ghost"
              aria-label="Execute search"
            >
              Search
            </button>
          </form>
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

      <div
        className="feed-editor"
        inert={isImmersive || undefined}
        aria-hidden={isImmersive || undefined}
      >
        <PostEditor />
      </div>

      <FindFriendCard onClick={() => navigateTo('/search')} />

      <SupportCard />

      {activeError && (
        <Alert tone="danger" style={{ marginBottom: '1.5rem' }}>
          Failed to load feed: {activeError}
        </Alert>
      )}

      {renderContent()}
    </section>
  );
}
