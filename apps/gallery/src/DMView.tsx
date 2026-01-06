import { nip19 } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

import { useDMs } from './hooks/useDMs';
import { ProfileLink } from './ui/ProfileLink';
import { Skeleton } from './ui/Skeleton';

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

  const activeConversation = conversations.find(c => c.peer === selectedPeer);

  useEffect(() => {
    if (activeConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Trigger decryption for new messages
      activeConversation.messages.forEach(async (msg) => {
        if (!decryptedCache[msg.id]) {
          const text = await decryptMessage(msg);
          setDecryptedCache(prev => ({ ...prev, [msg.id]: text }));
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
        <div className="dm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Messages</span>
          <button 
            className="action-btn"
            onClick={() => setShowNewMessage(true)}
            aria-label="Start a new conversation"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
          >
            + New
          </button>
        </div>
        
        {showNewMessage && (
          <div className="dm-new-message" style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border-muted)', background: 'var(--color-canvas-subtle)' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              New Conversation
            </div>
            <input
              ref={newRecipientInputRef}
              className="dm-input"
              value={newRecipient}
              onChange={e => { setNewRecipient(e.target.value); setRecipientError(null); }}
              onKeyDown={handleNewRecipientKeyDown}
              placeholder="Enter npub or hex pubkey..."
              aria-label="Recipient npub or pubkey"
              style={{ marginBottom: '0.5rem' }}
            />
            {recipientError && (
              <div style={{ color: 'var(--color-danger-fg)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                {recipientError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="action-btn" 
                onClick={handleStartNewConversation}
                style={{ flex: 1 }}
              >
                Start
              </button>
              <button 
                className="action-btn" 
                onClick={() => { setShowNewMessage(false); setNewRecipient(''); setRecipientError(null); }}
                style={{ flex: 1, borderColor: 'var(--color-border-muted)', color: 'var(--color-fg-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div className="dm-list">
          {loading && conversations.length === 0 && (
             <div style={{ padding: '1rem' }}>
               <Skeleton variant="text" height={40} style={{ marginBottom: '0.5rem' }} />
               <Skeleton variant="text" height={40} style={{ marginBottom: '0.5rem' }} />
               <Skeleton variant="text" height={40} />
             </div>
          )}
          {conversations.map(conv => (
            <div 
              key={conv.peer} 
              className={`dm-list-item ${selectedPeer === conv.peer ? 'active' : ''}`}
              onClick={() => setSelectedPeer(conv.peer)}
            >
              <ProfileLink pubkey={conv.peer} label={conv.peer.slice(0, 8)} style={{ pointerEvents: 'none' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)', marginTop: '0.2rem' }}>
                {new Date(conv.lastMessageAt * 1000).toLocaleDateString()}
              </div>
            </div>
          ))}
          {conversations.length === 0 && !loading && (
            <div style={{ padding: '1rem', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
              No messages yet.
            </div>
          )}
        </div>
      </div>

      <div className={`dm-main ${!selectedPeer ? 'hidden' : ''}`}>
        {selectedPeer ? (
          <>
            <div className="dm-header">
              <button 
                className="action-btn" 
                style={{ marginRight: '0.5rem', display: 'none' }} // Visible on mobile via CSS if needed, but handled by class toggling for now
                onClick={() => setSelectedPeer(null)}
              >
                &lt;
              </button>
              <ProfileLink pubkey={selectedPeer} />
            </div>
            <div className="dm-messages">
              {activeConversation?.messages.map(msg => (
                <div key={msg.id} className={`dm-message ${msg.isMine ? 'sent' : 'received'}`}>
                  {decryptedCache[msg.id] ?? 'Decrypting...'}
                  <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '0.2rem', textAlign: 'right' }}>
                    {new Date(msg.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="dm-input-area">
              <input
                className="dm-input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
              />
              <button className="action-btn" onClick={handleSend}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-fg-muted)' }}>
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}
