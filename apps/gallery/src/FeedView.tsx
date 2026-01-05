import { PaywalledContent, PostEditor, ReactionButton, ReplyModal, useStats, ZapButton } from '@nostrstack/blog-kit';
import MarkdownIt from 'markdown-it';
import type { Event } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';
import type { AbstractRelay } from 'nostr-tools/abstract-relay';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { markRelayFailure } from './nostr/api';
import { relayMonitor } from './nostr/relayHealth';
import { filterSpam, getSpamStats } from './nostr/spamFilter';
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

type RelayStatus = {
  status: 'connecting' | 'online' | 'error';
  reason?: string;
};

export function PostItem({
  post,
  authorLightningAddress,
  apiBase,
  enableRegtestPay
}: {
  post: Post;
  authorLightningAddress?: string;
  apiBase?: string;
  enableRegtestPay?: boolean;
}) {
  const [showJson, setShowJson] = useState(false);
  const [isZapped, setIsZapped] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const contentWarningTag = post.tags.find(t => t[0] === 'content-warning' || t[0] === 'sensitive');
  const hasContentWarning = Boolean(contentWarningTag);
  const contentWarningReason = contentWarningTag?.[1] || 'Sensitive content';
  const [showContent, setShowContent] = useState(!hasContentWarning);

  const isPaywalled = post.tags.some(tag => tag[0] === 'paywall');
  const paywallAmount = isPaywalled ? Number(post.tags.find(tag => tag[0] === 'paywall')?.[1] || '0') : 0;
  const paywallItemId = post.id; // Use event ID as item ID for paywall

  const renderContent = () => {
    if (hasContentWarning && !showContent) {
      return (
        <div className="content-warning-placeholder">
          <div className="content-warning-icon">⚠️</div>
          <div className="content-warning-text">
            <strong>Content Warning</strong>
            <span>{contentWarningReason}</span>
          </div>
          <button className="action-btn" onClick={() => setShowContent(true)}>Show Content</button>
        </div>
      );
    }

    return (
      <div 
        className="post-content" 
        dangerouslySetInnerHTML={{ __html: md.render(post.content) }} 
      />
    );
  };

  return (
    <article className="post-card" tabIndex={0}>
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
          <span style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>•</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>{new Date(post.created_at * 1000).toLocaleTimeString()}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '0.7rem', 
            padding: '2px 6px', 
            border: '1px solid var(--color-border-default)', 
            borderRadius: '10px',
            backgroundColor: 'var(--color-canvas-subtle)',
            color: 'var(--color-fg-muted)'
          }}>
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
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: 'var(--color-fg-muted)',
              background: 'var(--color-canvas-subtle)',
              borderRadius: '6px',
              border: '1px dashed var(--color-border-default)'
            }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>Premium Content</div>
              <div>This content requires a payment of {paywallAmount} sats to view.</div>
            </div>
          }
        />
      ) : (
        renderContent()
      )}
      
      <div className="post-actions">
        <ReactionButton event={post} />
        <ZapButton
          event={post}
          authorLightningAddress={authorLightningAddress}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
          onZapSuccess={() => setIsZapped(true)}
          className={isZapped ? 'zapped' : ''}
        />
        <button className="action-btn" onClick={() => setIsReplying(true)}>Reply</button>
        <button 
          className="action-btn" 
          onClick={() => setShowJson(!showJson)}
          style={{ marginLeft: 'auto' }}
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

      <ReplyModal 
        isOpen={isReplying} 
        onClose={() => setIsReplying(false)} 
        parentEvent={post} 
      />
    </article>
  );
}

export function FeedView() {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  const { isMuted } = useMuteList();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const seenIds = useRef(new Set<string>());
  const startTimes = useRef(new Map<string, number>());
  const { incrementEvents } = useStats();
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' || import.meta.env.DEV;

  const [relayStatus, setRelayStatus] = useState<Record<string, RelayStatus>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [spamFilterEnabled, setSpamFilterEnabled] = useState(false);

  // Reset status when relay list changes
  useEffect(() => {
    const initial: Record<string, RelayStatus> = {};
    relayList.forEach((relay) => {
      initial[relay] = { status: 'connecting' };
    });
    setRelayStatus(initial);
  }, [relayList, retryCount]);

  const relaySummary = useMemo(() => {
    const entries = Object.values(relayStatus);
    const total = entries.length;
    const online = entries.filter((entry) => entry.status === 'online').length;
    const errors = entries.filter((entry) => entry.status === 'error').length;
    return { total, online, errors };
  }, [relayStatus]);

  useEffect(() => {
    if (relaysLoading || relayList.length === 0) return;

    const pool = new SimplePool();
    // Trust mock relays to bypass signature verification in dev/test
    if (relayList.includes('mock')) {
      const poolWithTrust = pool as SimplePool & { trustedRelayURLs?: Set<string> };
      poolWithTrust.trustedRelayURLs?.add('mock');
    }
    let didUnmount = false;

    startTimes.current.clear();
    relayList.forEach((r) => {
      relayMonitor.reportAttempt(r);
      startTimes.current.set(r, Date.now());
    });

    const updateRelayStatus = (relay: string, next: RelayStatus) => {
      setRelayStatus((prev) => {
        const current = prev[relay];
        if (
          current &&
          current.status === next.status &&
          (current.reason ?? '') === (next.reason ?? '')
        ) {
          return prev;
        }
        return { ...prev, [relay]: next };
      });
    };

    const sub = pool.subscribeMany(
      relayList,
      { kinds: [1], limit: 20 },
      {
        onevent(event) {
          incrementEvents();
          if (!seenIds.current.has(event.id)) {
            seenIds.current.add(event.id);
            setPosts(prev => {
              const next = [...prev, event].sort((a, b) => b.created_at - a.created_at);
              return next.slice(0, 100); // Increased buffer
            });
          }
        },
        receivedEvent(relay: AbstractRelay) {
          updateRelayStatus(relay.url, { status: 'online' });
          const start = startTimes.current.get(relay.url);
          if (start) {
            const latency = Date.now() - start;
            relayMonitor.reportSuccess(relay.url, latency);
            startTimes.current.delete(relay.url);
          } else {
            relayMonitor.reportSuccess(relay.url);
          }
        },
        onclose(reasons) {
          if (didUnmount) return;
          reasons.forEach((reason, index) => {
            const relay = relayList[index];
            if (!relay || !reason) return;
            updateRelayStatus(relay, { status: 'error', reason });
            markRelayFailure(relay);
            console.warn(`[nostr] relay ${relay} closed: ${reason}`);
          });
        }
      }
    );
    const statusTimer = globalThis.setTimeout(() => {
      const statuses = pool.listConnectionStatus();
      relayList.forEach((relay) => {
        const isOnline = statuses.get(relay);
        if (isOnline) {
          updateRelayStatus(relay, { status: 'online' });
        }
      });
    }, 2000);

    return () => {
      didUnmount = true;
      globalThis.clearTimeout(statusTimer);
      void Promise.resolve()
        .then(() => sub.close('unmount'))
        .catch(() => {
          // Ignore close failures during teardown.
        })
        .finally(() => {
          try {
            pool.close(relayList);
          } catch {
            // Ignore websocket close errors during teardown.
          }
        });
    };
  }, [incrementEvents, relayList, relaysLoading, retryCount]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || posts.length === 0) return;
    setIsLoadingMore(true);
    const lastPost = posts[posts.length - 1];
    const until = lastPost.created_at - 1;
    const pool = new SimplePool();
    
    try {
      const olderPosts = await pool.querySync(relayList, { kinds: [1], until, limit: 20 });
      const uniqueOlder = olderPosts.filter(p => !seenIds.current.has(p.id));
      uniqueOlder.forEach(p => seenIds.current.add(p.id));
      
      setPosts(prev => {
        const next = [...prev, ...uniqueOlder].sort((a, b) => b.created_at - a.created_at);
        return next;
      });
    } catch (err) {
      console.error('Failed to load more posts', err);
    } finally {
      setIsLoadingMore(false);
      try { pool.close(relayList); } catch { /* ignore */ }
    }
  }, [isLoadingMore, posts, relayList]);

  if (relaysLoading) {
    return (
      <div className="feed-stream">
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="post-editor-container" style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <Skeleton variant="rectangular" height={100} width="100%" style={{ borderRadius: '6px' }} />
             <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
               <Skeleton variant="rectangular" width={100} height={36} style={{ borderRadius: '6px' }} />
             </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0', flexDirection: 'column' }}>
           {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="feed-stream">
      <div style={{ marginBottom: '1.5rem' }}>
        <PostEditor />
      </div>

      <FindFriendCard onClick={() => navigateTo('/search')} />
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--color-border-default)'
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Live Feed</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="action-btn"
            onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              borderColor: spamFilterEnabled ? 'var(--color-success-fg)' : 'var(--color-border-default)',
              color: spamFilterEnabled ? 'var(--color-success-fg)' : 'var(--color-fg-muted)'
            }}
          >
            {spamFilterEnabled ? '🛡️ Spam Filter: ON' : 'Spam Filter: OFF'}
          </button>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: relaySummary.errors > 0 ? 'var(--color-attention-fg)' : 'var(--color-success-fg)',
              marginRight: '6px'
            }} />
            {relaySummary.online}/{relaySummary.total} relays
          </div>
        </div>
      </div>

      {relaySummary.errors > 0 && (
        <Alert 
          tone="warning"
          onRetry={() => setRetryCount(c => c + 1)}
          retryLabel="Reconnect"
        >
          Some relays are temporarily unavailable. Streaming continues from {relaySummary.online} active relay
          {relaySummary.online === 1 ? '' : 's'}.
        </Alert>
      )}

      {posts.length === 0 && (
         <div style={{ display: 'flex', gap: '0', flexDirection: 'column' }}>
           {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
        </div>
      )}

      {(() => {
        const filtered = posts.filter(p => !isMuted(p.pubkey));
        const final = spamFilterEnabled ? filterSpam(filtered) : filtered;
        return final.map(post => (
          <PostItem key={post.id} post={post} apiBase={apiBase} enableRegtestPay={enableRegtestPay} />
        ));
      })()}

      {posts.length > 0 && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <button 
            className="auth-btn" 
            onClick={loadMore} 
            disabled={isLoadingMore}
            style={{ width: 'auto', minWidth: '200px' }}
          >
            {isLoadingMore ? (
              <>
                <span className="nostrstack-spinner" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
                LOADING...
              </>
            ) : (
              'LOAD MORE'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
