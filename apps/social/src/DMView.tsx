import { Skeleton } from '@nostrstack/ui';
import { nip19 } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

import { useCachedEvent } from './hooks/useCachedEvent';
import { type Conversation, type DMMessage, useDMs } from './hooks/useDMs';
import { ProfileLink } from './ui/ProfileLink';

interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
}

interface DMListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  decryptMessage: (message: DMMessage) => Promise<string>;
}

function DMListItem({ conversation, isActive, onClick, decryptMessage }: DMListItemProps) {
  const { get: getCached } = useCachedEvent();
  const [profile, setProfile] = useState<ProfileMetadata | null>(null);
  const [lastMessagePreview, setLastMessagePreview] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch profile metadata
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);

    getCached({ kinds: [0], authors: [conversation.peer] })
      .then((event) => {
        if (cancelled || !event) {
          setProfileLoading(false);
          return;
        }
        try {
          const metadata = JSON.parse(event.content) as ProfileMetadata;
          setProfile(metadata);
        } catch {
          // Invalid JSON
        }
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));

    return () => {
      cancelled = true;
    };
  }, [conversation.peer, getCached]);

  // Decrypt last message for preview
  useEffect(() => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return;

    decryptMessage(lastMessage)
      .then((text) => setLastMessagePreview(text.slice(0, 50) + (text.length > 50 ? '...' : '')))
      .catch(() => setLastMessagePreview('[Unable to decrypt]'));
  }, [conversation.messages, decryptMessage]);

  const displayName =
    profile?.display_name || profile?.name || conversation.peer.slice(0, 8) + '...';
  const avatarUrl =
    profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${conversation.peer}`;

  // Relative time formatting
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <button
      type="button"
      className={`dm-list-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-label={`Conversation with ${displayName}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
        <img
          src={avatarUrl}
          alt={`${displayName} avatar`}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            background: 'var(--ns-color-bg-subtle)'
          }}
          loading="lazy"
          decoding="async"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem'
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {profileLoading ? <Skeleton variant="text" width={80} height={16} /> : displayName}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--ns-color-text-muted)',
                flexShrink: 0
              }}
            >
              {getRelativeTime(conversation.lastMessageAt)}
            </span>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--ns-color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '0.15rem'
            }}
          >
            {lastMessagePreview ?? <Skeleton variant="text" width={120} height={14} />}
          </div>
        </div>
      </div>
    </button>
  );
}

export function DMView() {
  const { conversations, loading, sendDM, decryptMessage } = useDMs();
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const newRecipientInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find((c) => c.peer === selectedPeer);

  useEffect(() => {
    if (activeConversation) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      messagesEndRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      // Trigger decryption for new messages
      activeConversation.messages.forEach(async (msg) => {
        if (!decryptedCache[msg.id]) {
          const text = await decryptMessage(msg);
          setDecryptedCache((prev) => ({ ...prev, [msg.id]: text }));
        }
      });
    }
  }, [activeConversation, decryptMessage, decryptedCache]);

  // Focus new recipient input when modal opens
  useEffect(() => {
    if (showNewMessage && newRecipientInputRef.current) {
      newRecipientInputRef.current.focus();
    }
  }, [showNewMessage]);

  const handleStartNewConversation = () => {
    setRecipientError(null);
    const input = newRecipient.trim();

    if (!input) {
      setRecipientError('Please enter an npub or hex pubkey');
      return;
    }

    let pubkey: string;

    // Try to decode npub
    if (input.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(input);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          setRecipientError('Invalid npub format');
          return;
        }
      } catch {
        setRecipientError('Invalid npub');
        return;
      }
    } else if (/^[0-9a-f]{64}$/i.test(input)) {
      // It's a hex pubkey
      pubkey = input.toLowerCase();
    } else {
      setRecipientError('Enter a valid npub or 64-character hex pubkey');
      return;
    }

    // Set as selected peer and close the new message input
    setSelectedPeer(pubkey);
    setShowNewMessage(false);
    setNewRecipient('');
  };

  const handleNewRecipientKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStartNewConversation();
    } else if (e.key === 'Escape') {
      setShowNewMessage(false);
      setNewRecipient('');
      setRecipientError(null);
    }
  };

  const handleSend = async () => {
    if (!selectedPeer || !inputText.trim()) return;
    try {
      await sendDM(selectedPeer, inputText);
      setInputText('');
    } catch (err) {
      console.error('Failed to send DM', err);
      alert('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="dm-layout">
      <div className={`dm-sidebar ${selectedPeer ? 'hidden' : ''}`}>
        <div
          className="dm-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Messages</span>
          <button
            type="button"
            className="action-btn"
            onClick={() => setShowNewMessage(true)}
            aria-label="Start a new conversation"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
          >
            + New
          </button>
        </div>

        {showNewMessage && (
          <div
            className="dm-new-message"
            style={{
              padding: '0.75rem',
              borderBottom: '1px solid var(--ns-color-border-strong)',
              background: 'var(--ns-color-bg-subtle)'
            }}
          >
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              New Conversation
            </div>
            <input
              ref={newRecipientInputRef}
              className="dm-input"
              name="recipient"
              value={newRecipient}
              onChange={(e) => {
                setNewRecipient(e.target.value);
                setRecipientError(null);
              }}
              onKeyDown={handleNewRecipientKeyDown}
              placeholder="Enter npub or hex pubkey..."
              aria-label="Recipient npub or pubkey"
              aria-describedby={recipientError ? 'new-recipient-error' : undefined}
              aria-invalid={Boolean(recipientError)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ marginBottom: '0.5rem' }}
            />
            {recipientError && (
              <div
                id="new-recipient-error"
                style={{
                  color: 'var(--ns-color-danger-default)',
                  fontSize: '0.75rem',
                  marginBottom: '0.5rem'
                }}
                role="alert"
              >
                {recipientError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="action-btn"
                onClick={handleStartNewConversation}
                style={{ flex: 1 }}
              >
                Start
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => {
                  setShowNewMessage(false);
                  setNewRecipient('');
                  setRecipientError(null);
                }}
                style={{
                  flex: 1,
                  borderColor: 'var(--ns-color-border-strong)',
                  color: 'var(--ns-color-text-muted)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="dm-list">
          {loading && conversations.length === 0 && (
            <div style={{ padding: '1rem' }} aria-hidden="true">
              <Skeleton variant="text" height={40} style={{ marginBottom: '0.5rem' }} />
              <Skeleton variant="text" height={40} style={{ marginBottom: '0.5rem' }} />
              <Skeleton variant="text" height={40} />
            </div>
          )}
          {conversations.map((conv) => (
            <DMListItem
              key={conv.peer}
              conversation={conv}
              isActive={selectedPeer === conv.peer}
              onClick={() => setSelectedPeer(conv.peer)}
              decryptMessage={decryptMessage}
            />
          ))}
          {conversations.length === 0 && !loading && (
            <div
              style={{ padding: '1rem', color: 'var(--ns-color-text-muted)', textAlign: 'center' }}
              role="status"
              aria-live="polite"
            >
              <p style={{ marginBottom: '0.75rem' }}>No messages yet.</p>
              <button
                type="button"
                className="action-btn"
                onClick={() => setShowNewMessage(true)}
                style={{
                  borderColor: 'var(--ns-color-accent-default)',
                  color: 'var(--ns-color-accent-default)'
                }}
              >
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`dm-main ${!selectedPeer ? 'hidden' : ''}`}>
        {selectedPeer ? (
          <>
            <div className="dm-header">
              <button
                type="button"
                className="action-btn dm-back-btn"
                onClick={() => setSelectedPeer(null)}
                aria-label="Back to conversations list"
              >
                <span aria-hidden="true">&lt;</span>
                <span className="sr-only">Back</span>
              </button>
              <ProfileLink pubkey={selectedPeer} />
            </div>
            <div className="dm-messages" role="list" aria-live="polite">
              {activeConversation?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`dm-message ${msg.isMine ? 'sent' : 'received'}`}
                  role="listitem"
                >
                  {decryptedCache[msg.id] ?? 'Decrypting...'}
                  <div
                    style={{
                      fontSize: '0.65rem',
                      opacity: 0.7,
                      marginTop: '0.2rem',
                      textAlign: 'right'
                    }}
                  >
                    {new Date(msg.created_at * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="dm-input-area">
              <label className="sr-only" htmlFor="dm-message-input">
                Message
              </label>
              <input
                id="dm-message-input"
                className="dm-input"
                name="message"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                autoComplete="off"
                enterKeyHint="send"
              />
              <button type="button" className="action-btn" onClick={handleSend} aria-label="Send message">
                Send
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--ns-color-text-muted)'
            }}
            role="status"
            aria-live="polite"
          >
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}
