import { PostEditor, useAuth, useFeed } from '@nostrstack/react';
import { Alert, PostSkeleton } from '@nostrstack/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useContactList } from './hooks/useContactList';
import { useMuteList } from './hooks/useMuteList';
import { usePostNavigation } from './hooks/usePostNavigation';
import { useRelays } from './hooks/useRelays';
import { filterSpam } from './nostr/spamFilter';
import { FindFriendCard } from './ui/FindFriendCard';
import { NewPostsIndicator } from './ui/NewPostsIndicator';
import { NostrEventCard } from './ui/NostrEventCard';
import { navigateTo } from './utils/navigation';

export function FeedView() {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { isMuted } = useMuteList();
  const { contacts, loading: contactsLoading } = useContactList();
  const { pubkey } = useAuth();

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

  // Feed mode: 'all' shows all posts, 'following' shows only from contacts
  const [feedMode, setFeedMode] = useState<'all' | 'following'>(() => {
    if (typeof window === 'undefined') return 'all';
    const saved = localStorage.getItem('nostrstack.feedMode');
    return saved === 'following' ? 'following' : 'all';
  });

  // Persist feed mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nostrstack.feedMode', feedMode);
    }
  }, [feedMode]);

  // Determine feed parameters
  const isFollowingMode = feedMode === 'following';
  const canFetchFollowing = isFollowingMode && !contactsLoading && contacts.length > 0;
  const shouldFetch = !relaysLoading && (!isFollowingMode || canFetchFollowing);

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

  // Memoize filtered posts with safety checks
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
      return spamFilterEnabled ? filterSpam(filtered) : filtered;
    } catch (e) {
      console.error('Filter error', e);
      return posts;
    }
  }, [posts, isMuted, spamFilterEnabled]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setNewPosts([]);
    if (filteredPosts[0]) {
      lastSeenPostId.current = filteredPosts[0].id;
    }
  }, [filteredPosts]);

  const handleOpenThread = useCallback((eventId: string) => {
    navigateTo(`/nostr/${eventId}`);
  }, []);

  const renderContent = () => {
    if (relaysLoading || (feedLoading && posts.length === 0)) {
      return (
        <div className="feed-loading">
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (posts.length === 0 && !feedLoading) {
      return (
        <div className="feed-empty">
          <div className="feed-empty__icon">📝</div>
          <h3 className="feed-empty__title">No posts yet</h3>
          <p className="feed-empty__text">Be the first to share something with the network!</p>
          <button
            className="ns-btn ns-btn--primary"
            onClick={() => document.querySelector('textarea')?.focus()}
          >
            Write your first post
          </button>
        </div>
      );
    }

    return (
      <>
        {filteredPosts.map((post) => (
          <NostrEventCard
            key={post.id}
            event={post}
            apiBase={apiBase}
            enableRegtestPay={enableRegtestPay}
            onOpenThread={handleOpenThread}
          />
        ))}

        {hasMore && (
          <div className="feed-load-more">
            <button
              className="ns-btn ns-btn--primary feed-load-more__btn"
              onClick={loadMore}
              disabled={feedLoading}
            >
              {feedLoading ? 'Loading more...' : 'Load more posts'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <main className="feed-stream" role="main" aria-label="Live feed" ref={feedContainerRef}>
      <NewPostsIndicator newPosts={newPosts} onScrollToTop={handleScrollToTop} />

      <header className="feed-header">
        <h2 className="feed-title">Live Feed</h2>
        <div className="feed-header__actions">
          <button
            className={`ns-btn ns-btn--sm ${feedMode === 'all' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setFeedMode('all')}
          >
            All
          </button>
          <button
            className={`ns-btn ns-btn--sm ${feedMode === 'following' ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => pubkey && setFeedMode('following')}
            disabled={!pubkey}
          >
            Following
          </button>
          <button
            className={`ns-btn ns-btn--sm ${spamFilterEnabled ? 'ns-btn--primary' : 'ns-btn--ghost'}`}
            onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
            title="Toggle Spam Filter"
          >
            {spamFilterEnabled ? '🛡️ Filter ON' : '🛡️ Filter OFF'}
          </button>
        </div>
      </header>

      <div className="feed-editor">
        <PostEditor />
      </div>

      <FindFriendCard onClick={() => navigateTo('/search')} />

      {feedError && (
        <Alert tone="danger" style={{ marginBottom: '1.5rem' }}>
          Failed to load feed: {feedError}
        </Alert>
      )}

      {renderContent()}
    </main>
  );
}
