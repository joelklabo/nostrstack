import type { Event } from 'nostr-tools';
import { useEffect, useRef } from 'react';

import { PostEditor } from './post-editor';

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentEvent: Event;
}

export function ReplyModal({ isOpen, onClose, parentEvent }: ReplyModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (isOpen) {
      modal.showModal();
    } else {
      modal.close();
    }
  }, [isOpen]);

  // Handle Escape key (explicit handling as backup to native dialog behavior)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleClose = () => {
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };

  return (
    <dialog 
      ref={modalRef} 
      className="reply-modal"
      onClick={handleBackdropClick}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        maxWidth: '100%',
        maxHeight: '100%',
        margin: 'auto'
      }}
    >
      <div className="reply-modal-content" style={{
        background: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '12px',
        width: 'min(600px, 90vw)',
        padding: '0',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div className="reply-modal-header" style={{
          padding: '1rem',
          borderBottom: '1px solid var(--color-border-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Reply to note</h3>
          <button 
            onClick={handleClose}
            className="action-btn"
            style={{ padding: '0.25rem 0.5rem', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '1rem' }}>
          <PostEditor 
            parentEvent={parentEvent} 
            onSuccess={handleClose} 
            onCancel={handleClose}
            placeholder="Write your reply..."
            autoFocus
          />
        </div>
      </div>
    </dialog>
  );
}
