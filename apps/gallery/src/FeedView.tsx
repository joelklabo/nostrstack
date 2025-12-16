import { useState, useEffect, useRef } from 'react';
import { PostEditor, ZapButton, PaywalledContent, useStats } from '@nostrstack/blog-kit';
import { SimplePool } from 'nostr-tools';
import type { Event } from 'nostr-tools';
import { JsonView } from './ui/JsonView';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

interface Post extends Event {
  // Add any extra fields if needed
}

export function PostItem({ post }: { post: Post }) {
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
        <span title={post.pubkey}>{post.pubkey.slice(0, 8)}...</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', border: '1px solid var(--terminal-dim)', borderRadius: '4px' }}>K{post.kind}</span>
          <span>{new Date(post.created_at * 1000).toLocaleTimeString()}</span>
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
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--terminal-dim)' }}>
              CLASSIFIED: ACCESS DENIED. (REQUIRES {paywallAmount} SATS)
            </div>
          }
        />
      ) : (
        renderContent()
      )}
      
      <div className="post-actions">
        <ZapButton event={post} />
        <button className="action-btn">REPLY</button>
        <button className="action-btn" onClick={() => setShowJson(!showJson)}>
          {showJson ? 'HIDE_SRC' : 'VIEW_SRC'}
        </button>
      </div>
      {showJson && (
        <JsonView 
          value={post} 
          title={`EVENT_ID: ${post.id.slice(0, 8)}...`}
          style={{ marginTop: '1rem', borderTop: '1px dashed var(--terminal-border)' }} 
        />
      )}
    </article>
  );
}

export function FeedView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const seenIds = useRef(new Set<string>());
  const { incrementEvents } = useStats();

  useEffect(() => {
    const pool = new SimplePool();

    const sub = pool.subscribeMany(
      RELAYS,
      [{ kinds: [1], limit: 20 }],
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
      sub.close();
      pool.close(RELAYS);
    };
  }, []);

      return (
        <div className="feed-stream">
          <PostEditor />
          <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--terminal-text)', paddingTop: '1rem' }}>                {' >'} STREAMING_LIVE_EVENTS...      </div>      {posts.map(post => (
        <PostItem key={post.id} post={post} />
      ))}
    </div>
  );
}
