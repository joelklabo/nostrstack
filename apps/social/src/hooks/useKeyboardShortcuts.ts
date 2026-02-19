import { useEffect, useState } from 'react';

export type View = 'feed' | 'search' | 'profile' | 'settings' | 'offers' | 'help';

interface KeyboardShortcutsOptions {
  currentView: View;
  setCurrentView: (view: View) => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { currentView, setCurrentView } = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isHelpShortcut = event.key === '?' || (event.code === 'Slash' && event.shiftKey);

      // Skip if typing in input/textarea
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputField && event.key !== 'Escape') {
        // Allow escape to work even in input fields
        return;
      }

      const isInDialog = !!target.closest(
        '[role="dialog"], [aria-modal="true"], .emoji-picker, .shortcuts-overlay, .ns-dialog-overlay'
      );

      if (isInDialog && event.key !== '?' && event.key !== 'Escape') {
        return;
      }

      if (isHelpShortcut) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      switch (event.key) {
        case 'j':
          // Post navigation handled by usePostNavigation hook
          event.preventDefault();
          break;

        case 'k':
          // Post navigation handled by usePostNavigation hook
          if (event.metaKey || event.ctrlKey) {
            // Cmd+K or Ctrl+K for search
            event.preventDefault();
            setCurrentView('search');
          } else {
            event.preventDefault();
          }
          break;

        case '/':
          // Focus search
          event.preventDefault();
          setCurrentView('search');
          break;

        case 'Escape':
          // Close modals
          event.preventDefault();
          setHelpOpen(false);
          break;

        case 'n':
          // Go to feed to focus new post composer
          event.preventDefault();
          setCurrentView('feed');
          break;

        case 'g':
          // g+h: home (feed)
          if (event.shiftKey) {
            event.preventDefault();
            setCurrentView('feed');
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [setCurrentView, currentView]);

  return { helpOpen, setHelpOpen };
}
