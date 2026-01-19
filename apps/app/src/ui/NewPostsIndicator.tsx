import { memo, useCallback, useEffect, useState } from 'react';

import { Image } from './Image';

interface NewPostInfo {
  pubkey: string;
  picture?: string;
}

interface NewPostsIndicatorProps {
  /** Array of new posts info (pubkey and optional picture) */
  newPosts: NewPostInfo[];
  /** Callback when user clicks to scroll to top */
  onScrollToTop: () => void;
  /** Maximum number of avatars to show */
  maxAvatars?: number;
}

/**
 * Floating indicator that shows when new posts are available.
 * Shows avatars of users who posted, and scrolls to top when clicked.
 * Inspired by Primal's new content indicator.
 */
export const NewPostsIndicator = memo(function NewPostsIndicator({
  newPosts,
  onScrollToTop,
  maxAvatars = 3
}: NewPostsIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Show indicator when there are new posts
  useEffect(() => {
    if (newPosts.length > 0) {
      setIsVisible(true);
      setIsAnimatingOut(false);
    }
  }, [newPosts.length]);

  const handleClick = useCallback(() => {
    setIsAnimatingOut(true);
    // Wait for animation before calling callback
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimatingOut(false);
      onScrollToTop();
    }, 200);
  }, [onScrollToTop]);

  // Handle keyboard accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  if (!isVisible || newPosts.length === 0) {
    return null;
  }

  const displayPosts = newPosts.slice(0, maxAvatars);
  const extraCount = newPosts.length - maxAvatars;

  return (
    <button
      className={`new-posts-indicator ${isAnimatingOut ? 'is-hiding' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${newPosts.length} new posts. Click to scroll to top.`}
      type="button"
    >
      <div className="new-posts-indicator__avatars">
        {displayPosts.map((post, index) => (
          <div
            key={post.pubkey}
            className="new-posts-indicator__avatar"
            style={{ zIndex: maxAvatars - index }}
          >
            <Image
              src={post.picture}
              alt=""
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          </div>
        ))}
      </div>
      <span className="new-posts-indicator__text" role="status" aria-live="polite">
        {newPosts.length === 1 ? '1 new post' : `${newPosts.length} new posts`}
        {extraCount > 0 && ` (+${extraCount})`}
      </span>
      <span className="new-posts-indicator__icon" aria-hidden="true">
        ↑
      </span>
    </button>
  );
});
