import { PaywalledContent, PostEditor, useStats, ZapButton } from '@nostrstack/blog-kit';
import type { Event } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

import { JsonView } from './ui/JsonView';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

interface Post extends Event {
  // Add any extra fields if needed
}

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
  const isPaywalled = post.tags.some(tag => tag[0] === 'paywall');
  const paywallAmount = isPaywalled ? Number(post.tags.find(tag => tag[0] === 'paywall')?.[1] || '0') : 0;
  const paywallItemId = post.id; // Use event ID as item ID for paywall

  const renderContent = () => (
    <div className="post-content">
      {post.content}
    </div>
  );

  return (
    <article className="post-card">
      <header className="post-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontWeight: '600', color: 'var(--color-fg-default)' }} title={post.pubkey}>
            {post.pubkey.slice(0, 8)}...
          </div>
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
        <ZapButton
          event={post}
          authorLightningAddress={authorLightningAddress}
          apiBase={apiBase}
          enableRegtestPay={enableRegtestPay}
        />
        <button className="action-btn">Reply</button>
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
    </article>
  );
}

export function FeedView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const seenIds = useRef(new Set<string>());
  const { incrementEvents } = useStats();
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' || import.meta.env.DEV;

  useEffect(() => {
    const pool = new SimplePool();

    const sub = pool.subscribeMany(
      RELAYS,
      { kinds: [1], limit: 20 },
      {
        onevent(event) {
          incrementEvents();
          if (!seenIds.current.has(event.id)) {
            seenIds.current.add(event.id);
            setPosts(prev => {
              const next = [...prev, event].sort((a, b) => b.created_at - a.created_at);
              return next.slice(0, 50);
            });
          }
        },
      }
    );

    return () => {
      void Promise.resolve(sub.close('unmount'))
        .then(() => {
          try {
            pool.close(RELAYS);
          } catch {
            // Ignore websocket close errors during teardown.
          }
        })
        .catch(() => {
          // Ignore close failures during teardown.
        });
    };
  }, []);

  return (
    <div className="feed-stream">
      <div style={{ marginBottom: '1.5rem' }}>
        <PostEditor />
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '1rem', 
        paddingBottom: '0.5rem', 
        borderBottom: '1px solid var(--color-border-default)' 
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Live Feed</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: 'var(--color-success-fg)', 
            marginRight: '6px' 
          }} />
          Streaming
        </div>
      </div>

      {posts.map(post => (
        <PostItem key={post.id} post={post} apiBase={apiBase} enableRegtestPay={enableRegtestPay} />
      ))}
    </div>
  );
}
