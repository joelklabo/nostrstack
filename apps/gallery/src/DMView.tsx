import { useEffect, useRef, useState } from 'react';

import { type DMMessage, useDMs } from './hooks/useDMs';
import { ProfileLink } from './ui/ProfileLink';
import { Skeleton } from './ui/Skeleton';

export function DMView() {
  const { conversations, loading, sendDM, decryptMessage } = useDMs();
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        <div className="dm-header">Messages</div>
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
