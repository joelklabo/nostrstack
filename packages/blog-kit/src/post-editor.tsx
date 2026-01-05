import { type Event, type EventTemplate, SimplePool } from 'nostr-tools';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { useNostrstackConfig } from './context';

export interface PostEditorProps {
  parentEvent?: Event;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PostEditor({ parentEvent, onSuccess, onCancel, placeholder, autoFocus }: PostEditorProps) {
  const { pubkey, signEvent, mode, error } = useAuth();
  const cfg = useNostrstackConfig();
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const maxLength = 1000;
  const currentLength = content.length;
  const isOverLimit = currentLength > maxLength;
  const isNearLimit = currentLength > maxLength * 0.9;

  const hasMedia = useMemo(() => {
    return /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(content);
  }, [content]);

  const handlePublish = useCallback(async () => {
    if (!pubkey) {
      setPublishStatus('ERROR: Not authenticated. Please login.');
      return;
    }
    if (!content.trim()) {
      setPublishStatus('ERROR: Content cannot be empty.');
      return;
    }
    if (isOverLimit) {
      setPublishStatus('ERROR: Content is too long.');
      return;
    }

    setIsPublishing(true);
    setPublishStatus('STATUS: Signing event...');

    try {
      const tags: string[][] = [];
      if (parentEvent) {
        // NIP-10: Reply tags
        // Find existing root (e marker with root, or first e tag if no markers)
        const rootTag = parentEvent.tags.find(t => t[0] === 'e' && t[3] === 'root');
        
        // If there's a root, preserve it. If not, the parent IS the root.
        const rootId = rootTag ? rootTag[1] : parentEvent.id;
        
        if (rootId !== parentEvent.id) {
            tags.push(['e', rootId, '', 'root']);
        }
        tags.push(['e', parentEvent.id, '', 'reply']);

        // p tags: author of parent + anyone mentioned in parent
        const mentions = new Set<string>();
        mentions.add(parentEvent.pubkey);
        parentEvent.tags.forEach(t => {
            if (t[0] === 'p' && t[1]) mentions.add(t[1]);
        });
        mentions.forEach(p => {
             if (p !== pubkey) tags.push(['p', p]);
        });
      }

      const template: EventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: content.trim(),
      };

      const signedEvent = await signEvent(template);
      setPublishStatus(`STATUS: Event signed. ID: ${signedEvent.id.slice(0, 8)}... Publishing...`);

      const relays = cfg.relays?.length 
        ? cfg.relays 
        : ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];
      
      const pool = new SimplePool();
      await Promise.any(pool.publish(relays, signedEvent));
      pool.close(relays);
      
      setPublishStatus(`SUCCESS: Event published to relays.`);
      setContent('');
      onSuccess?.();
    } catch (err: unknown) {
      setPublishStatus(`ERROR: Failed to publish: ${(err instanceof Error ? err.message : String(err))}`);
    } finally {
      setIsPublishing(false);
    }
  }, [pubkey, content, signEvent, cfg.relays, isOverLimit, parentEvent, onSuccess]);

  if (!pubkey) {
    return (
      <div className="post-editor-container">
        <div className="system-msg error-msg">ACCESS_DENIED: User not authenticated.</div>
        {error && <div className="system-msg error-msg">{`[ERROR]: ${error}`}</div>}
      </div>
    );
  }

  return (
    <div className="post-editor-container" role="form" aria-label={parentEvent ? 'Reply to note' : 'Create new note'}>
      <div className="editor-header">
        <span className="editor-prompt" aria-hidden="true">[{mode.toUpperCase()}] {'>'}</span> {parentEvent ? 'Reply to note:' : 'Post a new note:'}
      </div>
      <textarea
        className="terminal-input editor-input"
        id="post-editor"
        name="post"
        placeholder={placeholder ?? "WHAT ARE YOU HACKING ON?..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPublishing}
        rows={4}
        autoFocus={autoFocus}
        aria-label={parentEvent ? 'Reply content' : 'Note content'}
        aria-describedby="editor-counter"
        aria-invalid={isOverLimit}
      />
      {hasMedia && (
        <div className="editor-media-hint" role="status" aria-live="polite">
          <span aria-hidden="true">📷</span> Media URL detected. It will be embedded by clients.
        </div>
      )}
      <div className="editor-footer">
        <div 
          id="editor-counter"
          className={`editor-counter ${isOverLimit ? 'is-over-limit' : isNearLimit ? 'is-near-limit' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={`Character count: ${currentLength} of ${maxLength}${isOverLimit ? ', exceeds limit' : ''}`}
        >
          {currentLength} / {maxLength}
        </div>
        <div className="editor-actions" role="group" aria-label="Editor actions">
          {onCancel && (
            <button 
              className="action-btn" 
              onClick={onCancel} 
              disabled={isPublishing} 
              style={{marginRight: '0.5rem'}}
              aria-label="Cancel editing"
            >
              CANCEL
            </button>
          )}
          <button 
            className="auth-btn" 
            onClick={handlePublish} 
            disabled={isPublishing || isOverLimit}
            aria-label={isPublishing ? 'Publishing note' : 'Publish note'}
            aria-busy={isPublishing}
            aria-disabled={isOverLimit}
          >
            {isPublishing ? 'PUBLISHING...' : 'PUBLISH_EVENT'}
          </button>
        </div>
      </div>
      {publishStatus && (
        <div 
          className={`system-msg ${publishStatus.startsWith('ERROR') ? 'error-msg' : publishStatus.startsWith('SUCCESS') ? 'success-msg' : ''}`}
          role="status"
          aria-live="assertive"
        >
          {publishStatus}
        </div>
      )}
    </div>
  );
}
