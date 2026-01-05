import { useEffect, useState } from 'react';

import { navigateTo } from '../utils/navigation';

export type View = 'feed' | 'search' | 'profile' | 'notifications' | 'relays' | 'offers' | 'settings' | 'personal-site-kit';

interface UseKeyboardShortcutsProps {
  currentView: View | string;
  setCurrentView: (view: View) => void;
}

export function useKeyboardShortcuts({ currentView, setCurrentView }: UseKeyboardShortcutsProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if input/textarea is focused, except for Escape
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        if (e.key === 'Escape') {
          target.blur();
          setHelpOpen(false);
        }
        return;
      }

      switch (e.key) {
        case '?':
          if (e.shiftKey) { // ? is Shift+/
             setHelpOpen(prev => !prev);
          }
          break;
        case 'Escape':
          setHelpOpen(false);
          break;
        case '/':
          e.preventDefault();
          if (currentView !== 'search') {
            navigateTo('/search');
            setCurrentView('search');
            // Allow time for render
            setTimeout(() => {
                const searchInput = document.querySelector('input[type="search"]') || document.querySelector('input[placeholder*="Search"]');
                if (searchInput instanceof HTMLElement) searchInput.focus();
            }, 100);
          } else {
            const searchInput = document.querySelector('input[type="search"]') || document.querySelector('input[placeholder*="Search"]');
            if (searchInput instanceof HTMLElement) searchInput.focus();
          }
          break;
        case 'n':
           e.preventDefault();
           if (currentView !== 'feed') {
             navigateTo('/');
             setCurrentView('feed');
             setTimeout(() => {
               const editor = document.querySelector('textarea.editor-input');
               if (editor instanceof HTMLElement) editor.focus();
             }, 100);
           } else {
             const editor = document.querySelector('textarea.editor-input');
             if (editor instanceof HTMLElement) editor.focus();
           }
           break;
        case 'j':
          handleNavigatePosts('next');
          break;
        case 'k':
          handleNavigatePosts('prev');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, setCurrentView]);

  return { helpOpen, setHelpOpen };
}

function handleNavigatePosts(direction: 'next' | 'prev') {
  const posts = Array.from(document.querySelectorAll('article.post-card'));
  if (posts.length === 0) return;

  const currentFocus = document.activeElement;
  let index = posts.findIndex(p => p === currentFocus || p.contains(currentFocus));

  if (index === -1) {
    // If nothing focused, j -> 0, k -> nothing (or last?)
    if (direction === 'next') index = 0;
    else return; // or index = posts.length - 1;
  } else {
    if (direction === 'next') index = Math.min(index + 1, posts.length - 1);
    else index = Math.max(index - 1, 0);
  }

  const target = posts[index] as HTMLElement;
  target.focus();
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
