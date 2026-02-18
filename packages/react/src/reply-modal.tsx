import type { Event } from 'nostr-tools';
import { useEffect, useRef } from 'react';

import { useAuth } from './auth';
import { PostEditor } from './post-editor';

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentEvent: Event;
}

export function ReplyModal({ isOpen, onClose, parentEvent }: ReplyModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const { mode, error } = useAuth();

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const closeDialog = () => {
      if (modal.open) {
        modal.close();
        return;
      }
      if (modal.hasAttribute('open')) {
        modal.removeAttribute('open');
      }
    };

    if (isOpen) {
      if (!modal.open) {
        modal.showModal();
      }
    } else {
      closeDialog();
    }

    return () => {
      closeDialog();
    };
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

  const handleDialogCancel = () => {
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Modal backdrop click pattern
    <dialog
      ref={modalRef}
      className="reply-modal"
      onCancel={handleDialogCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
      style={{
        padding: 0,
        pointerEvents: 'none',
        border: 'none',
        background: 'transparent',
        maxWidth: '100%',
        maxHeight: '100%',
        margin: 'auto'
      }}
    >
      <div
        className="reply-modal-content"
        style={{
          background: 'var(--color-canvas-default)',
          pointerEvents: 'auto',
          border: '1px solid var(--color-border-default)',
          borderRadius: '12px',
          width: 'min(600px, 90vw)',
          padding: '0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div
          className="reply-modal-header"
          style={{
            padding: '1rem',
            borderBottom: '1px solid var(--color-border-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Reply to note</h3>
          <button
            type="button"
            onClick={handleClose}
            className="action-btn"
            aria-label="Close reply modal"
            style={{ padding: '0.25rem 0.5rem', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '1rem' }}>
          {mode === 'guest' ? (
            <div className="post-editor-container">
              <div className="system-msg">
                Sign in to post your reply. <a href="/login">Sign in</a> to continue.
                {error ? <span className="system-msg error-msg">{` ${error}`}</span> : null}
              </div>
            </div>
          ) : (
            <>
              {/* eslint-disable jsx-a11y/no-autofocus -- Modal opens with focus for UX */}
              <PostEditor
                parentEvent={parentEvent}
                onSuccess={handleClose}
                onCancel={handleClose}
                placeholder="Write your reply..."
                autoFocus
              />
              {/* eslint-enable jsx-a11y/no-autofocus */}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
