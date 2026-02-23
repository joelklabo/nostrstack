import { useToast } from '@nostrstack/ui';
import { useCallback, useState } from 'react';

import {
  CelebratingBlockHeight,
  type CelebrationStyle,
  useBlockCelebrationPreferences
} from './BlockCelebration';

/**
 * Settings panel for block celebration preferences
 */
export function CelebrationSettings() {
  const [prefs, updatePrefs] = useBlockCelebrationPreferences();
  const toast = useToast();
  const [previewBlockHeight, setPreviewBlockHeight] = useState(880000);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleSoundToggle = useCallback(() => {
    const nextSoundEnabled = !prefs.soundEnabled;
    updatePrefs({ soundEnabled: nextSoundEnabled });
    toast({
      message: `Celebration sound ${nextSoundEnabled ? 'enabled' : 'disabled'}.`,
      tone: 'success'
    });
  }, [prefs.soundEnabled, toast, updatePrefs]);

  const handleAnimationToggle = useCallback(() => {
    const nextAnimationEnabled = !prefs.animationEnabled;
    updatePrefs({ animationEnabled: nextAnimationEnabled });
    toast({
      message: `Celebration animations ${nextAnimationEnabled ? 'enabled' : 'disabled'}.`,
      tone: 'success'
    });
  }, [prefs.animationEnabled, toast, updatePrefs]);

  const handleStyleChange = useCallback(
    (style: CelebrationStyle) => {
      updatePrefs({ style });
      toast({
        message: `Celebration style set to ${style.replace('-', ' ')}.`,
        tone: 'success'
      });
    },
    [toast, updatePrefs]
  );

  const handlePreview = useCallback(() => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    // Increment the preview block height to trigger celebration
    setPreviewBlockHeight((prev) => prev + 1);
    // Reset preview state after animation completes
    setTimeout(() => setIsPreviewing(false), 3000);
  }, [isPreviewing]);

  return (
    <div className="celebration-settings" role="group" aria-label="Block celebration settings">
      <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>
        Block Celebration
      </h4>

      {/* Animation Enable/Disable */}
      <div className="celebration-setting-row">
        <div className="celebration-setting-label">
          <span>Enable Animations</span>
          <span>Show celebration effect when new block is mined</span>
        </div>
        <button
          type="button"
          className="ns-toggle"
          role="switch"
          aria-checked={prefs.animationEnabled}
          onClick={handleAnimationToggle}
          aria-label="Toggle celebration animations"
        >
          <span className="sr-only">
            {prefs.animationEnabled ? 'Animations enabled' : 'Animations disabled'}
          </span>
        </button>
      </div>

      {/* Sound Toggle */}
      <div className="celebration-setting-row">
        <div className="celebration-setting-label">
          <span>Celebration Sound</span>
          <span>Play a subtle sound when new block arrives</span>
        </div>
        <button
          type="button"
          className="celebration-sound-toggle"
          data-enabled={prefs.soundEnabled}
          onClick={handleSoundToggle}
          aria-label={prefs.soundEnabled ? 'Disable celebration sound' : 'Enable celebration sound'}
          aria-pressed={prefs.soundEnabled}
        >
          <svg
            className="sound-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {prefs.soundEnabled ? (
              <>
                {/* Speaker with sound waves */}
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            ) : (
              <>
                {/* Speaker muted */}
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            )}
          </svg>
          <span>{prefs.soundEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Celebration Style */}
      <div
        className="celebration-setting-row"
        style={{ flexDirection: 'column', alignItems: 'flex-start' }}
      >
        <div className="celebration-setting-label" style={{ marginBottom: 'var(--ns-space-2)' }}>
          <span>Celebration Style</span>
          <span>Choose how the celebration looks</span>
        </div>
        <div
          className="celebration-style-selector"
          role="radiogroup"
          aria-label="Celebration style selection"
        >
          <button
            type="button"
            className="celebration-style-btn"
            role="radio"
            aria-checked={prefs.style === 'glow-pulse'}
            onClick={() => handleStyleChange('glow-pulse')}
          >
            Glow Pulse
          </button>
          <button
            type="button"
            className="celebration-style-btn"
            role="radio"
            aria-checked={prefs.style === 'confetti'}
            onClick={() => handleStyleChange('confetti')}
          >
            Confetti
          </button>
          <button
            type="button"
            className="celebration-style-btn"
            role="radio"
            aria-checked={prefs.style === 'none'}
            onClick={() => handleStyleChange('none')}
          >
            None
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div
        className="celebration-setting-row"
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginTop: 'var(--ns-space-2)'
        }}
      >
        <div className="celebration-setting-label" style={{ marginBottom: 'var(--ns-space-2)' }}>
          <span>Preview</span>
          <span>See the celebration in action</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ns-space-4)',
            width: '100%',
            padding: 'var(--ns-space-3)',
            background: 'var(--ns-color-bg-subtle)',
            borderRadius: 'var(--ns-radius-md)',
            border: '1px solid var(--ns-color-border-default)'
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--ns-color-text-muted)',
                marginBottom: 'var(--ns-space-1)'
              }}
            >
              Block Height
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'var(--ns-font-weight-bold)',
                color: 'var(--ns-color-text-default)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <CelebratingBlockHeight value={previewBlockHeight} preferences={prefs} />
            </div>
          </div>
          <button
            type="button"
            className="celebration-preview-btn"
            onClick={handlePreview}
            disabled={isPreviewing || !prefs.animationEnabled || prefs.style === 'none'}
            aria-label="Preview celebration animation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {isPreviewing ? 'Playing...' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Accessibility note */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--ns-color-text-subtle)',
          marginTop: 'var(--ns-space-2)'
        }}
      >
        Note: Animations are automatically disabled when &ldquo;Reduce motion&rdquo; is enabled in
        your system settings.
      </div>
    </div>
  );
}
