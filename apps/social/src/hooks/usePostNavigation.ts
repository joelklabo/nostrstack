import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePostNavigationOptions {
  /** CSS selector for post elements */
  postSelector?: string;
  /** Enable/disable navigation */
  enabled?: boolean;
  /** Callback when a post action is triggered */
  onAction?: (action: 'like' | 'zap' | 'reply' | 'thread', element: HTMLElement) => void;
}

/**
 * Hook for keyboard navigation between posts.
 * Supports J/K for navigation, Enter for opening thread,
 * L for like, Z for zap, R for reply.
 */
export function usePostNavigation(options: UsePostNavigationOptions = {}) {
  const { postSelector = '.ns-event-card', enabled = true, onAction } = options;

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const postsRef = useRef<HTMLElement[]>([]);

  // Get all post elements
  const getPosts = useCallback(() => {
    return Array.from(document.querySelectorAll(postSelector)) as HTMLElement[];
  }, [postSelector]);

  // Scroll element into view with offset for fixed header
  const scrollIntoViewWithOffset = useCallback((element: HTMLElement) => {
    const headerOffset = 80; // Account for fixed header
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }, []);

  // Focus a post by index
  const focusPost = useCallback(
    (index: number) => {
      const posts = getPosts();
      postsRef.current = posts;

      if (index < 0 || index >= posts.length) return;

      // Remove focus from previous
      posts.forEach((post) => post.classList.remove('is-keyboard-focused'));

      // Add focus to new
      const targetPost = posts[index];
      if (targetPost) {
        targetPost.classList.add('is-keyboard-focused');
        targetPost.focus({ preventScroll: true });
        scrollIntoViewWithOffset(targetPost);
        setFocusedIndex(index);
      }
    },
    [getPosts, scrollIntoViewWithOffset]
  );

  // Navigate to next post
  const nextPost = useCallback(() => {
    const posts = getPosts();
    const newIndex = focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, posts.length - 1);
    focusPost(newIndex);
  }, [focusedIndex, focusPost, getPosts]);

  // Navigate to previous post
  const prevPost = useCallback(() => {
    const newIndex = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
    focusPost(newIndex);
  }, [focusedIndex, focusPost]);

  // Clear focus
  const clearFocus = useCallback(() => {
    const posts = getPosts();
    posts.forEach((post) => post.classList.remove('is-keyboard-focused'));
    setFocusedIndex(-1);
  }, [getPosts]);

  // Trigger action on focused post
  const triggerAction = useCallback(
    (action: 'like' | 'zap' | 'reply' | 'thread') => {
      const posts = getPosts();
      const focusedPost = posts[focusedIndex];
      if (!focusedPost) return;

      // Find action button in post
      let button: HTMLElement | null = null;
      switch (action) {
        case 'like':
          button = focusedPost.querySelector('.emoji-reaction-wrapper button');
          break;
        case 'zap':
          button = focusedPost.querySelector('.zap-btn, [aria-label*="Zap"]');
          break;
        case 'reply':
          button = focusedPost.querySelector('[aria-label*="Reply"]');
          break;
        case 'thread':
          button = focusedPost.querySelector('[aria-label*="thread"]');
          break;
      }

      if (button) {
        button.click();
      }

      onAction?.(action, focusedPost);
    },
    [focusedIndex, getPosts, onAction]
  );

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputField) return;

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          nextPost();
          break;

        case 'k':
        case 'ArrowUp':
          // Don't interfere with Cmd+K search
          if (event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          prevPost();
          break;

        case 'Enter':
          if (focusedIndex >= 0) {
            event.preventDefault();
            triggerAction('thread');
          }
          break;

        case 'l':
          if (focusedIndex >= 0) {
            event.preventDefault();
            triggerAction('like');
          }
          break;

        case 'z':
          if (focusedIndex >= 0) {
            event.preventDefault();
            triggerAction('zap');
          }
          break;

        case 'r':
          if (focusedIndex >= 0) {
            event.preventDefault();
            triggerAction('reply');
          }
          break;

        case 'Escape':
          clearFocus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, nextPost, prevPost, focusedIndex, triggerAction, clearFocus]);

  // Clear focus when clicking elsewhere
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(postSelector)) {
        clearFocus();
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [enabled, postSelector, clearFocus]);

  return {
    focusedIndex,
    nextPost,
    prevPost,
    focusPost,
    clearFocus,
    triggerAction
  };
}
