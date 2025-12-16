import { PostEditor } from '@nostrstack/blog-kit';
import type { Event } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

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

  return (
    <article className="post-card">
      <header className="post-header">
        <span title={post.pubkey}>{post.pubkey.slice(0, 8)}...</span>
        <span>{new Date(post.created_at * 1000).toLocaleTimeString()}</span>
      </header>
      <div className="post-content">
        {post.content}
      </div>
      <div className="post-actions">
        <ZapButton event={post} />
        <button className="action-btn">REPLY</button>
        <button className="action-btn" onClick={() => setShowJson(!showJson)}>
          {showJson ? 'HIDE_SRC' : 'VIEW_SRC'}
        </button>
      </div>
      {showJson && (
        <pre style={{ 
          fontSize: '0.7rem', 
          color: 'var(--terminal-dim)', 
          overflow: 'auto',
          marginTop: '1rem',
          borderTop: '1px dashed var(--terminal-border)'
        }}>
          {JSON.stringify(post, null, 2)}
        </pre>
      )}
    </article>
  );
}

export function FeedView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const subs: { relay: Relay; sub: ReturnType<Relay['subscribe']> }[] = [];
    
    const connect = async () => {
      // Connect to first working relay for demo (in production use SimplePool)
      for (const url of RELAYS) {
        try {
          const relay = await Relay.connect(url);
          console.log(`Connected to ${url}`);
          
          const sub = relay.subscribe([
            { kinds: [1], limit: 20 }
          ], {
            onevent(event) {
              if (!seenIds.current.has(event.id)) {
                seenIds.current.add(event.id);
                setPosts(prev => {
                  const next = [...prev, event].sort((a, b) => b.created_at - a.created_at);
                  return next.slice(0, 50);
                });
              }
            }
          });
          subs.push({ relay, sub });
          // Just one relay for now to avoid duplicates logic complexity in "bare bones"
          break; 
        } catch (e) {
          console.error(`Failed to connect to ${url}`);
        }
      }
    };

    connect();

    return () => {
      subs.forEach(({ relay }) => relay.close());
    };
  }, []);

  return (
    <div className="feed-stream">
      <PostEditor />
              <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--terminal-text)', paddingTop: '1rem' }}>
                {' >'} STREAMING_LIVE_EVENTS...      </div>
      {posts.map(post => (
        <PostItem key={post.id} post={post} />
      ))}
    </div>
  );
}
