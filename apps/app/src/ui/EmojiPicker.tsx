import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';

// Common reaction emojis - curated set for social media reactions
const EMOJI_CATEGORIES = {
  reactions: ['👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', '💯', '🎉'],
  faces: ['😀', '😊', '🥰', '😎', '🤔', '😴', '🤯', '🥳', '😤', '🤣'],
  gestures: ['👏', '🤝', '✌️', '🤙', '💪', '🙌', '👀', '🫡', '🤷', '🫠'],
  symbols: ['⚡', '✨', '💜', '💙', '💚', '🧡', '🖤', '💛', '❤️‍🔥', '💎']
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();
const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '⚡', '🙏'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
  id?: string;
  /** Show quick reaction bar instead of full picker */
  quickMode?: boolean;
}

export const EmojiPicker = memo(function EmojiPicker({
  onSelect,
  onClose,
  isOpen,
  id,
  quickMode = false
}: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('reactions');

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from the click that opened it
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  // Quick mode: just a row of common reactions
  if (quickMode) {
    return (
      <div
        className="emoji-picker emoji-picker--quick"
        ref={pickerRef}
        role="listbox"
        aria-label="Quick reactions"
        aria-orientation="horizontal"
        id={resolvedId}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            className="emoji-picker__emoji"
            onClick={() => handleEmojiClick(emoji)}
            aria-label={`React with ${emoji}`}
            role="option"
            aria-selected={false}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  // Full picker with categories
  return (
    <div
      className="emoji-picker"
      ref={pickerRef}
      role="dialog"
      aria-label="Emoji picker"
      id={resolvedId}
    >
      <div className="emoji-picker__header">
        {(Object.keys(EMOJI_CATEGORIES) as (keyof typeof EMOJI_CATEGORIES)[]).map((category) => (
          <button
            type="button"
            key={category}
            className={`emoji-picker__category ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
            aria-label={`${category} emoji category`}
          >
            {category === 'reactions' && '❤️'}
            {category === 'faces' && '😀'}
            {category === 'gestures' && '👏'}
            {category === 'symbols' && '⚡'}
          </button>
        ))}
      </div>
      <div className="emoji-picker__grid" role="listbox" aria-label={`${activeCategory} emojis`}>
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button
            type="button"
            key={emoji}
            className="emoji-picker__emoji"
            onClick={() => handleEmojiClick(emoji)}
            aria-label={`React with ${emoji}`}
            role="option"
            aria-selected={false}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
});

// Export the emoji lists for use in other components
export { ALL_EMOJIS, EMOJI_CATEGORIES, QUICK_REACTIONS };
