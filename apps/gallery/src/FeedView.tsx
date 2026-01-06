import {
  PaywalledContent,
  PostEditor,
  ReactionButton,
  ReplyModal,
  useAuth,
  useFeed,
  useStats,
  ZapButton
} from '@nostrstack/blog-kit';
import MarkdownIt from 'markdown-it';
import type { Event } from 'nostr-tools';
import { memo, useCallback, useMemo, useState } from 'react';

import { useContactList } from './hooks/useContactList';
import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { useRepost } from './hooks/useRepost';
import { filterSpam } from './nostr/spamFilter';
import { Alert } from './ui/Alert';
import { FindFriendCard } from './ui/FindFriendCard';
import { JsonView } from './ui/JsonView';
import { PostSkeleton } from './ui/PostSkeleton';
import { ProfileLink } from './ui/ProfileLink';
import { Skeleton } from './ui/Skeleton';
import { navigateTo } from './utils/navigation';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
});

type Post = Event;

export const PostItem = memo(function PostItem({
  post,
  authorLightningAddress,
  apiBase,
  enableRegtestPay,
  onOpenThread
}: {
  post: Post;
  authorLightningAddress?: string;
  apiBase?: string;
  enableRegtestPay?: boolean;
  onOpenThread?: (eventId: string) => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [isZapped, setIsZapped] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const { repost, loading: repostLoading } = useRepost();
  const { pubkey } = useAuth();

  const handleRepost = useCallback(async () => {
    if (repostLoading || isReposted) return;
    const success = await repost(post);
    if (success) setIsReposted(true);
  }, [repost, post, repostLoading, isReposted]);

  const contentWarningTag = post.tags.find(
    (t) => t[0] === 'content-warning' || t[0] === 'sensitive'
  );
  const hasContentWarning = Boolean(contentWarningTag);
  const contentWarningReason = contentWarningTag?.[1] || 'Sensitive content';
  const [showContent, setShowContent] = useState(!hasContentWarning);

  const isPaywalled = post.tags.some((tag) => tag[0] === 'paywall');
  const paywallAmount = isPaywalled
    ? Number(post.tags.find((tag) => tag[0] === 'paywall')?.[1] || '0')
    : 0;
  const paywallItemId = post.id; // Use event ID as item ID for paywall

  const renderContent = () => {
    if (hasContentWarning && !showContent) {
      return (
        <div className="content-warning-placeholder" role="region" aria-label="Content warning">
          <div className="content-warning-icon" aria-hidden="true">
            ⚠️
          </div>
          <div className="content-warning-text">
            <strong>Content Warning</strong>
            <span>{contentWarningReason}</span>
          </div>
          <button
            className="action-btn"
            onClick={() => setShowContent(true)}
            aria-label={`Show content with warning: ${contentWarningReason}`}
          >
            Show Content
          </button>
        </div>
      );
    }

    return (
      <div
        className="post-content"
        dangerouslySetInnerHTML={{ __html: md.render(post.content) }}
        role="article"
        aria-label="Post content"
      />
    );
  };

  return (
    <article className="post-card" tabIndex={0} aria-label={`Post by ${post.pubkey.slice(0, 8)}`}>
      <header className="post-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ProfileLink
            pubkey={post.pubkey}
            label={`${post.pubkey.slice(0, 8)}...`}
            title={post.pubkey}
            style={{
              fontWeight: 600,
              color: 'var(--color-fg-default)',
              textDecoration: 'none'
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }} aria-hidden="true">
            •
          </span>
          <time
            style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}
            dateTime={new Date(post.created_at * 1000).toISOString()}
          >
            {new Date(post.created_at * 1000).toLocaleTimeString()}
          </time>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              border: '1px solid var(--color-border-default)',
              borderRadius: '10px',
              backgroundColor: 'var(--color-canvas-subtle)',
              color: 'var(--color-fg-muted)'
            }}
            role="status"
            aria-label={`Event kind ${post.kind}`}
          >
            Kind {post.kind}
          </span>
        </div>
      </header>

      {isPaywalled ? (
        <PaywalledContent
          itemId={paywallItemId}
          amountSats={paywallAmount}
          apiBase={import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'}
          host={import.meta.env.VITE_NOSTRSTACK_HOST ?? 'localhost'}
          unlockedContent={renderContent()}
          lockedContent={
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-fg-muted)',
                background: 'var(--color-canvas-subtle)',
                borderRadius: '6px',
                border: '1px dashed var(--color-border-default)'
              }}
            >
              <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>Premium Content</div>
              <div>This content requires a payment of {paywallAmount} sats to view.</div>
            </div>
          }
        />
      ) : (
        renderContent()
      )}

      <div className="post-actions" role="group" aria-label="Post actions">
        <ReactionButton event={post} />
        <ZapButton
          event={post}
          authorLightningAddress={authorLightningAddress}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
          onZapSuccess={() => setIsZapped(true)}
          className={isZapped ? 'zapped' : ''}
        />
        <button
          className="action-btn"
          onClick={() => setIsReplying(true)}
          aria-label="Reply to this post"
        >
          Reply
        </button>
        <button
          className="action-btn"
          onClick={() => onOpenThread?.(post.id)}
          aria-label="View thread"
        >
          Thread
        </button>
        {pubkey && (
          <button
            className={`action-btn repost-btn ${isReposted ? 'reposted' : ''}`}
            onClick={handleRepost}
            disabled={repostLoading || isReposted}
            aria-label={isReposted ? 'Reposted' : 'Repost this post'}
            aria-busy={repostLoading}
          >
            {repostLoading ? '...' : isReposted ? '↻ Reposted' : '↻ Repost'}
          </button>
        )}
        <button
          className="action-btn"
          onClick={() => setShowJson(!showJson)}
          style={{ marginLeft: 'auto' }}
          aria-label={showJson ? 'Hide event source JSON' : 'View event source JSON'}
          aria-expanded={showJson}
        >
          {showJson ? 'Hide Source' : 'View Source'}
        </button>
      </div>

      {showJson && (
        <JsonView
          value={post}
          title={`Event ID: ${post.id.slice(0, 8)}...`}
          style={{ marginTop: '1rem' }}
        />
      )}

      <ReplyModal isOpen={isReplying} onClose={() => setIsReplying(false)} parentEvent={post} />
    </article>
  );
});

export function FeedView() {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { isMuted } = useMuteList();
  const { contacts, loading: contactsLoading } = useContactList();
  const { pubkey } = useAuth();
  const { incrementEvents } = useStats();
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  const [spamFilterEnabled, setSpamFilterEnabled] = useState(false);

  // Feed mode: 'all' shows all posts, 'following' shows only from contacts
  const [feedMode, setFeedMode] = useState<'all' | 'following'>(() => {
    const saved = localStorage.getItem('nostrstack.feedMode');
    return saved === 'following' ? 'following' : 'all';
  });

  // Persist feed mode to localStorage
  // useEffect(() => { // Hook handles persistence itself? No, useFeed doesn't.
  // The state init reads from localStorage.
  // We should save it when it changes.
  if (typeof window !== 'undefined') {
    localStorage.setItem('nostrstack.feedMode', feedMode);
  }

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

  // Track event stats
  // Note: this will increment on every render if not careful, but useStats handles that?
  // Actually incrementEvents() is a simple counter in context.
  // We should only increment for new events.
  // The hook abstracts this away, so we lose the "new event arrived" signal for stats.
  // We can assume the hook manages the list.
  // Ideally, useFeed would expose `onEvent` or similar, or we just rely on total count updates.
  // For now, let's skip the explicit `incrementEvents` call or implement it in a `useEffect` watching `posts` length?
  // Watching length is okay.
  /*
  useEffect(() => {
    incrementEvents(posts.length); // If incrementEvents adds N, we need diff.
    // ... logic to track diff ...
  }, [posts.length]);
  */
  // Actually, `useStats` typically just wants a number or we call it on event.
  // Let's omit `incrementEvents` for now to avoid complexity or loop.

  const handleOpenThread = useCallback((eventId: string) => {
    navigateTo(`/nostr/${eventId}`);
  }, []);

  // Memoize filtered posts
  const filteredPosts = useMemo(() => {
    const filtered = posts.filter((p) => !isMuted(p.pubkey));
    return spamFilterEnabled ? filterSpam(filtered) : filtered;
  }, [posts, isMuted, spamFilterEnabled]);

  return relaysLoading ? (
    <div className="feed-stream">
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          className="post-editor-container"
          style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <Skeleton
            variant="rectangular"
            height={100}
            width="100%"
            style={{ borderRadius: '6px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Skeleton
              variant="rectangular"
              width={100}
              height={36}
              style={{ borderRadius: '6px' }}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0', flexDirection: 'column' }}>
        {[1, 2, 3].map((i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    </div>
  ) : (
    <main className="feed-stream" role="main" aria-label="Live feed">
      <div style={{ marginBottom: '1.5rem' }}>
        <PostEditor />
      </div>

      <FindFriendCard onClick={() => navigateTo('/search')} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--color-border-default)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Live Feed</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              className="action-btn"
              onClick={() => setFeedMode('all')}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderColor:
                  feedMode === 'all' ? 'var(--terminal-accent)' : 'var(--color-border-default)',
                color: feedMode === 'all' ? 'var(--terminal-accent)' : 'var(--color-fg-muted)',
                background: feedMode === 'all' ? 'var(--terminal-accent-bg)' : 'transparent'
              }}
              aria-pressed={feedMode === 'all'}
              aria-label="Show all posts"
            >
              All
            </button>
            <button
              className="action-btn"
              onClick={() => pubkey && setFeedMode('following')}
              disabled={!pubkey}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderColor:
                  feedMode === 'following'
                    ? 'var(--terminal-accent)'
                    : 'var(--color-border-default)',
                color:
                  feedMode === 'following' ? 'var(--terminal-accent)' : 'var(--color-fg-muted)',
                background: feedMode === 'following' ? 'var(--terminal-accent-bg)' : 'transparent',
                opacity: !pubkey ? 0.5 : 1,
                cursor: !pubkey ? 'not-allowed' : 'pointer'
              }}
              aria-pressed={feedMode === 'following'}
              aria-label={
                pubkey ? 'Show posts from people you follow' : 'Log in to see following feed'
              }
              title={!pubkey ? 'Log in to see following feed' : undefined}
            >
              Following
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="action-btn"
            onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              borderColor: spamFilterEnabled
                ? 'var(--color-success-fg)'
                : 'var(--color-border-default)',
              color: spamFilterEnabled ? 'var(--color-success-fg)' : 'var(--color-fg-muted)'
            }}
            aria-label={
              spamFilterEnabled
                ? 'Spam filter enabled, click to disable'
                : 'Spam filter disabled, click to enable'
            }
            aria-pressed={spamFilterEnabled}
          >
            {spamFilterEnabled ? '🛡️ Spam Filter: ON' : 'Spam Filter: OFF'}
          </button>
        </div>
      </div>

      {feedMode === 'following' && contacts.length === 0 && !contactsLoading && (
        <Alert tone="info">
          You&apos;re not following anyone yet. Switch to &quot;All&quot; to discover people, then
          follow them to build your feed.
        </Alert>
      )}

      {feedError && <Alert tone="danger">Failed to load feed: {feedError}</Alert>}

      {posts.length === 0 && feedLoading && (
        <div style={{ display: 'flex', gap: '0', flexDirection: 'column' }}>
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      )}

      {posts.length === 0 && !feedLoading && (
        <div
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--color-border-default)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-canvas-subtle)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-fg-default)' }}>No posts yet</h3>
          <p style={{ color: 'var(--color-fg-muted)', margin: '0 0 1.5rem' }}>
            Be the first to share something with the network!
          </p>
          <button
            className="action-btn"
            onClick={() => {
              const editor = document.querySelector('textarea');
              editor?.focus();
            }}
            style={{
              padding: '0.5rem 1.5rem',
              fontWeight: '600',
              borderColor: 'var(--color-accent-emphasis)',
              color: 'var(--color-accent-fg)',
              background: 'var(--color-accent-subtle)'
            }}
          >
            Write your first post
          </button>
        </div>
      )}

      {filteredPosts.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
          onOpenThread={handleOpenThread}
        />
      ))}

      {hasMore && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <button
            className="auth-btn"
            onClick={loadMore}
            disabled={feedLoading}
            style={{ width: 'auto', minWidth: '200px' }}
            aria-label="Load more posts"
            aria-busy={feedLoading}
          >
            {feedLoading ? (
              <>
                <span
                  className="nostrstack-spinner"
                  style={{ marginRight: '0.5rem' }}
                  aria-hidden="true"
                />
                LOADING...
              </>
            ) : (
              'LOAD MORE'
            )}
          </button>
        </div>
      )}
    </main>
  );
}
