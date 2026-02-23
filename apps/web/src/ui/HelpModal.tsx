import '../styles/shortcuts.css';

import { useEffect, useRef } from 'react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Store trigger element and focus first focusable element
  useEffect(() => {
    if (!open) return;

    // Store the element that had focus before modal opened
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
    }

    // Return focus to trigger when modal closes
    return () => {
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Return null if not open - AFTER all hooks
  if (!open) return null;

  const shortcuts = [
    { keys: ['j', '↓'], desc: 'Next post' },
    { keys: ['k', '↑'], desc: 'Previous post' },
    { keys: ['l'], desc: 'Like focused post' },
    { keys: ['z'], desc: 'Zap focused post' },
    { keys: ['r'], desc: 'Reply to focused post' },
    { keys: ['Enter'], desc: 'Open thread' },
    { keys: ['/'], desc: 'Search' },
    { keys: ['n'], desc: 'New post' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close modal / Clear focus' }
  ];

  return (
    <div
      className="shortcuts-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={modalRef}
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="shortcuts-header">
          <div id="help-modal-title" className="shortcuts-title">
            Keyboard Shortcuts
          </div>
          <button
            type="button"
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            &times;
          </button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-list">
            {shortcuts.map((s, i) => (
              <div key={i} className="shortcut-item">
                <div className="shortcut-desc">{s.desc}</div>
                <div className="shortcut-keys">
                  {s.keys.map((k) => (
                    <span key={k} className="shortcut-key">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
