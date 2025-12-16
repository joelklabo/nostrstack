import { type EventTemplate, SimplePool } from 'nostr-tools';
import { useCallback, useState } from 'react';

import { useAuth } from './auth';

export function PostEditor() {
  const { pubkey, signEvent, mode, error } = useAuth();
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const handlePublish = useCallback(async () => {
    if (!pubkey) {
      setPublishStatus('ERROR: Not authenticated. Please login.');
      return;
    }
    if (!content.trim()) {
      setPublishStatus('ERROR: Content cannot be empty.');
      return;
    }

    setIsPublishing(true);
    setPublishStatus('STATUS: Signing event...');

    try {
      const template: EventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: content.trim(),
      };

      const signedEvent = await signEvent(template);
      setPublishStatus(`STATUS: Event signed. ID: ${signedEvent.id.slice(0, 8)}... Publishing...`);

      // For now, hardcode relays. Later, use user's configured relays.
      const relays = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];
      
      const pool = new SimplePool();
      await Promise.any(pool.publish(relays, signedEvent));
      pool.close(relays);
      
      setPublishStatus(`SUCCESS: Event published to relays.`);
      setContent('');
    } catch (err: unknown) {
      setPublishStatus(`ERROR: Failed to publish: ${(err instanceof Error ? err.message : String(err))}`);
    } finally {
      setIsPublishing(false);
    }
  }, [pubkey, content, signEvent]);

  if (!pubkey) {
    return (
      <div className="post-editor-container">
        <div className="system-msg">ACCESS_DENIED: User not authenticated.</div>
        {error && <div className="error-msg">{`[ERROR]: ${error}`}</div>}
      </div>
    );
  }

  return (
    <div className="post-editor-container">
      <div className="editor-header">
        <span className="editor-prompt">[{mode.toUpperCase()}] {'>'}</span> Post a new note:
      </div>
      <textarea
        className="terminal-input editor-input"
        placeholder="WHAT ARE YOU HACKING ON?..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPublishing}
        rows={4}
      />
      <div className="editor-actions">
        <button className="auth-btn" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? 'PUBLISHING...' : 'PUBLISH_EVENT'}
        </button>
      </div>
      {publishStatus && (
        <div className={`system-msg ${publishStatus.startsWith('ERROR') ? 'error-msg' : ''}`}>
          {publishStatus}
        </div>
      )}
    </div>
  );
}
