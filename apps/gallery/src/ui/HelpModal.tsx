import '../styles/shortcuts.css';

import { useEffect } from 'react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const shortcuts = [
    { keys: ['j', 'k'], desc: 'Navigate posts' },
    { keys: ['/'], desc: 'Search' },
    { keys: ['n'], desc: 'New post' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close modal' },
  ];

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title">Keyboard Shortcuts</div>
          <button className="shortcuts-close" onClick={onClose} aria-label="Close keyboard shortcuts">&times;</button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-list">
            {shortcuts.map((s, i) => (
              <div key={i} className="shortcut-item">
                <div className="shortcut-desc">{s.desc}</div>
                <div className="shortcut-keys">
                  {s.keys.map(k => (
                    <span key={k} className="shortcut-key">{k}</span>
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
