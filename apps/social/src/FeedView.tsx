import { PostEditor, useAuth, useFeed } from '@nostrstack/react';
import { Alert , PostSkeleton } from '@nostrstack/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useContactList } from './hooks/useContactList';
import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { filterSpam } from './nostr/spamFilter';
import { FindFriendCard } from './ui/FindFriendCard';
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

  const handleOpenThread = useCallback((eventId: string) => {
    navigateTo(`/nostr/${eventId}`);
  }, []);

  const renderContent = () => {
    if (relaysLoading || (feedLoading && posts.length === 0)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (posts.length === 0 && !feedLoading) {
      return (
        <div
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--nostrstack-color-border)',
            borderRadius: 'var(--nostrstack-radius-lg)',
            backgroundColor: 'var(--nostrstack-color-surface-subtle)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📝</div>
          <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>No posts yet</h3>
          <p style={{ color: 'var(--nostrstack-color-text-muted)', margin: '0 0 2rem' }}>
            Be the first to share something with the network!
          </p>
          <button
            className="nostrstack-btn nostrstack-btn--primary"
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
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <button
              className="nostrstack-btn nostrstack-btn--primary"
              onClick={loadMore}
              disabled={feedLoading}
              style={{ minWidth: '200px' }}
            >
              {feedLoading ? 'Loading more...' : 'Load more posts'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <main className="feed-stream" role="main" aria-label="Live feed">
      <header className="feed-header">
        <h2 className="feed-title">Live Feed</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`nostrstack-btn nostrstack-btn--sm ${feedMode === 'all' ? 'nostrstack-btn--primary' : 'nostrstack-btn--ghost'}`}
            onClick={() => setFeedMode('all')}
          >
            All
          </button>
          <button
            className={`nostrstack-btn nostrstack-btn--sm ${feedMode === 'following' ? 'nostrstack-btn--primary' : 'nostrstack-btn--ghost'}`}
            onClick={() => pubkey && setFeedMode('following')}
            disabled={!pubkey}
          >
            Following
          </button>
          <button
            className={`nostrstack-btn nostrstack-btn--sm ${spamFilterEnabled ? 'nostrstack-btn--primary' : 'nostrstack-btn--ghost'}`}
            onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
            title="Toggle Spam Filter"
          >
            {spamFilterEnabled ? '🛡️ Filter ON' : '🛡️ Filter OFF'}
          </button>
        </div>
      </header>

      <div style={{ marginBottom: '2rem' }}>
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
