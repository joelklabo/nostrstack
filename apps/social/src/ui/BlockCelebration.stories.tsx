import './block-celebration.css';

import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';

import {
  BlockCelebration,
  type BlockCelebrationPreferences,
  CelebratingBlockHeight,
  type CelebrationStyle
} from './BlockCelebration';
import { CelebrationSettings } from './CelebrationSettings';

const meta: Meta<typeof BlockCelebration> = {
  title: 'Components/BlockCelebration',
  component: BlockCelebration,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Block Celebration Effect

A delightful visual celebration when a new Bitcoin block is mined. Supports two styles:

## Approach 1: Glow Pulse
Radial glow emanating from the block height number with expanding concentric rings.
- Bitcoin-orange color scheme
- Subtle and professional
- 2.5 second duration

## Approach 2: Confetti Burst
Bitcoin-orange confetti particles burst outward with rotation and gravity effects.
- More playful and celebratory
- Shimmer trail effect
- 2 second duration

## Features
- Respects \`prefers-reduced-motion\` system preference
- Works in both light and dark themes
- Optional sound toggle (off by default)
- User-configurable via Settings
        `
      }
    }
  },
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof BlockCelebration>;

// Helper component for interactive demos
function CelebrationDemo({ initialStyle }: { initialStyle: CelebrationStyle }) {
  const [isActive, setIsActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [style, setStyle] = useState<CelebrationStyle>(initialStyle);

  const triggerCelebration = useCallback(() => {
    setIsActive(true);
    setTimeout(() => setIsActive(false), 3000);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
        minWidth: '300px'
      }}
    >
      <div
        style={{
          position: 'relative',
          padding: '2rem 4rem',
          background: 'var(--ns-color-bg-subtle)',
          borderRadius: 'var(--ns-radius-lg)',
          border: '1px solid var(--ns-color-border-default)'
        }}
      >
        <div
          style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
            color: isActive ? 'var(--ns-color-bitcoin-default)' : 'var(--ns-color-text-default)',
            transition: 'color 0.3s ease'
          }}
        >
          #880,000
        </div>
        <BlockCelebration
          isActive={isActive}
          style={style}
          soundEnabled={soundEnabled}
          onComplete={() => setIsActive(false)}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={triggerCelebration}
          disabled={isActive}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--ns-color-bitcoin-default)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--ns-radius-md)',
            fontWeight: 500,
            cursor: isActive ? 'not-allowed' : 'pointer',
            opacity: isActive ? 0.5 : 1
          }}
        >
          {isActive ? 'Playing...' : 'Trigger Celebration'}
        </button>

        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as CelebrationStyle)}
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--ns-color-surface-default)',
            border: '1px solid var(--ns-color-border-default)',
            borderRadius: 'var(--ns-radius-md)',
            color: 'var(--ns-color-text-default)'
          }}
        >
          <option value="glow-pulse">Glow Pulse</option>
          <option value="confetti">Confetti</option>
          <option value="none">None</option>
        </select>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--ns-color-surface-default)',
            border: '1px solid var(--ns-color-border-default)',
            borderRadius: 'var(--ns-radius-md)',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
          />
          Sound
        </label>
      </div>
    </div>
  );
}

// Interactive demo for the CelebratingBlockHeight component
function BlockHeightDemo() {
  const [blockHeight, setBlockHeight] = useState(880000);
  const [prefs, setPrefs] = useState<BlockCelebrationPreferences>({
    soundEnabled: false,
    animationEnabled: true,
    style: 'glow-pulse'
  });

  const mineBlock = useCallback(() => {
    setBlockHeight((prev) => prev + 1);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem'
      }}
    >
      <div
        style={{
          padding: '1.5rem 3rem',
          background: 'var(--ns-color-bg-subtle)',
          borderRadius: 'var(--ns-radius-lg)',
          border: '1px solid var(--ns-color-border-default)'
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--ns-color-text-muted)',
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}
        >
          Block Height
        </div>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            textAlign: 'center'
          }}
        >
          <CelebratingBlockHeight value={blockHeight} preferences={prefs} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={mineBlock}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--ns-color-bitcoin-default)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--ns-radius-md)',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Mine New Block
        </button>

        <select
          value={prefs.style}
          onChange={(e) => setPrefs((p) => ({ ...p, style: e.target.value as CelebrationStyle }))}
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--ns-color-surface-default)',
            border: '1px solid var(--ns-color-border-default)',
            borderRadius: 'var(--ns-radius-md)',
            color: 'var(--ns-color-text-default)'
          }}
        >
          <option value="glow-pulse">Glow Pulse</option>
          <option value="confetti">Confetti</option>
          <option value="none">None</option>
        </select>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--ns-color-surface-default)',
            border: '1px solid var(--ns-color-border-default)',
            borderRadius: 'var(--ns-radius-md)',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={prefs.soundEnabled}
            onChange={(e) => setPrefs((p) => ({ ...p, soundEnabled: e.target.checked }))}
          />
          Sound
        </label>
      </div>
    </div>
  );
}

export const GlowPulse: Story = {
  render: () => <CelebrationDemo initialStyle="glow-pulse" />,
  parameters: {
    docs: {
      description: {
        story:
          'Radial glow emanating from the block height with expanding concentric rings. Professional and subtle.'
      }
    }
  }
};

export const Confetti: Story = {
  render: () => <CelebrationDemo initialStyle="confetti" />,
  parameters: {
    docs: {
      description: {
        story:
          'Bitcoin-orange confetti particles burst outward with rotation and gravity effects. More playful and celebratory.'
      }
    }
  }
};

export const BlockHeightWithCelebration: Story = {
  render: () => <BlockHeightDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo showing the CelebratingBlockHeight component. Click "Mine New Block" to see the celebration effect.'
      }
    }
  }
};

export const SettingsPanel: Story = {
  render: () => (
    <div
      style={{
        maxWidth: '400px',
        padding: '1.5rem',
        background: 'var(--ns-color-surface-default)',
        borderRadius: 'var(--ns-radius-lg)',
        border: '1px solid var(--ns-color-border-default)'
      }}
    >
      <CelebrationSettings />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Settings panel for configuring block celebration preferences. Includes animation toggle, sound toggle, style selection, and preview.'
      }
    }
  }
};

export const SideBySideComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div>
        <h3
          style={{
            textAlign: 'center',
            marginBottom: '1rem',
            color: 'var(--ns-color-text-default)'
          }}
        >
          Glow Pulse
        </h3>
        <CelebrationDemo initialStyle="glow-pulse" />
      </div>
      <div>
        <h3
          style={{
            textAlign: 'center',
            marginBottom: '1rem',
            color: 'var(--ns-color-text-default)'
          }}
        >
          Confetti
        </h3>
        <CelebrationDemo initialStyle="confetti" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison of both celebration styles.'
      }
    }
  }
};
