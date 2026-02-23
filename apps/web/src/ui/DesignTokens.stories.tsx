import type { Meta, StoryObj } from '@storybook/react';

/**
 * Design Tokens Documentation
 *
 * NostrStack uses a W3C DTCG-compliant design token system from @nostrstack/tokens.
 * All tokens are available as CSS custom properties with the `--ns-*` prefix.
 */

const ColorSwatch = ({ name, value }: { name: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: value,
        border: '1px solid var(--ns-color-border-default)',
        boxShadow: 'var(--ns-shadow-sm)'
      }}
    />
    <div>
      <code style={{ fontSize: 12, fontFamily: 'var(--ns-font-family-mono)' }}>{name}</code>
      <div style={{ fontSize: 11, color: 'var(--ns-color-text-subtle)' }}>{value}</div>
    </div>
  </div>
);

const TokenGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>{title}</h3>
    {children}
  </div>
);

const TokenGrid = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '1rem'
    }}
  >
    {children}
  </div>
);

const SpacingSample = ({ name, size }: { name: string; size: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
    <div
      style={{
        width: size,
        height: 24,
        background: 'var(--ns-color-primary-default)',
        borderRadius: 4
      }}
    />
    <code style={{ fontSize: 12, fontFamily: 'var(--ns-font-family-mono)' }}>{name}</code>
    <span style={{ fontSize: 11, color: 'var(--ns-color-text-subtle)' }}>{size}</span>
  </div>
);

const RadiusSample = ({ name, size }: { name: string; size: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
    <div
      style={{
        width: 48,
        height: 48,
        background: 'var(--ns-color-primary-muted)',
        border: '2px solid var(--ns-color-primary-default)',
        borderRadius: size
      }}
    />
    <code style={{ fontSize: 12, fontFamily: 'var(--ns-font-family-mono)' }}>{name}</code>
    <span style={{ fontSize: 11, color: 'var(--ns-color-text-subtle)' }}>{size}</span>
  </div>
);

const ShadowSample = ({ name, value }: { name: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
    <div
      style={{
        width: 64,
        height: 64,
        background: 'var(--ns-color-surface-default)',
        borderRadius: 'var(--ns-radius-lg)',
        boxShadow: value
      }}
    />
    <code style={{ fontSize: 12, fontFamily: 'var(--ns-font-family-mono)' }}>{name}</code>
  </div>
);

const DesignTokensDoc = () => (
  <div className="ns-theme" style={{ padding: '2rem', maxWidth: 1200 }}>
    <h1 style={{ marginBottom: '0.5rem' }}>Design Tokens</h1>
    <p style={{ color: 'var(--ns-color-text-subtle)', marginBottom: '2rem' }}>
      All tokens use CSS custom properties with the <code>--ns-*</code> prefix. Import from{' '}
      <code>@nostrstack/tokens</code> or use the generated CSS.
    </p>

    <TokenGroup title="Primary Colors">
      <TokenGrid>
        <ColorSwatch name="--ns-color-primary-default" value="var(--ns-color-primary-default)" />
        <ColorSwatch name="--ns-color-primary-hover" value="var(--ns-color-primary-hover)" />
        <ColorSwatch name="--ns-color-primary-active" value="var(--ns-color-primary-active)" />
        <ColorSwatch name="--ns-color-primary-subtle" value="var(--ns-color-primary-subtle)" />
        <ColorSwatch name="--ns-color-primary-muted" value="var(--ns-color-primary-muted)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Accent Colors">
      <TokenGrid>
        <ColorSwatch name="--ns-color-accent-default" value="var(--ns-color-accent-default)" />
        <ColorSwatch name="--ns-color-accent-hover" value="var(--ns-color-accent-hover)" />
        <ColorSwatch name="--ns-color-accent-active" value="var(--ns-color-accent-active)" />
        <ColorSwatch name="--ns-color-accent-subtle" value="var(--ns-color-accent-subtle)" />
        <ColorSwatch name="--ns-color-accent-muted" value="var(--ns-color-accent-muted)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Semantic Colors">
      <TokenGrid>
        <ColorSwatch name="--ns-color-success-default" value="var(--ns-color-success-default)" />
        <ColorSwatch name="--ns-color-warning-default" value="var(--ns-color-warning-default)" />
        <ColorSwatch name="--ns-color-danger-default" value="var(--ns-color-danger-default)" />
        <ColorSwatch name="--ns-color-info-default" value="var(--ns-color-info-default)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Background & Surface">
      <TokenGrid>
        <ColorSwatch name="--ns-color-bg-default" value="var(--ns-color-bg-default)" />
        <ColorSwatch name="--ns-color-bg-subtle" value="var(--ns-color-bg-subtle)" />
        <ColorSwatch name="--ns-color-bg-muted" value="var(--ns-color-bg-muted)" />
        <ColorSwatch name="--ns-color-surface-default" value="var(--ns-color-surface-default)" />
        <ColorSwatch name="--ns-color-surface-raised" value="var(--ns-color-surface-raised)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Text Colors">
      <TokenGrid>
        <ColorSwatch name="--ns-color-text-default" value="var(--ns-color-text-default)" />
        <ColorSwatch name="--ns-color-text-subtle" value="var(--ns-color-text-subtle)" />
        <ColorSwatch name="--ns-color-text-muted" value="var(--ns-color-text-muted)" />
        <ColorSwatch name="--ns-color-text-disabled" value="var(--ns-color-text-disabled)" />
        <ColorSwatch name="--ns-color-text-link" value="var(--ns-color-text-link)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Border Colors">
      <TokenGrid>
        <ColorSwatch name="--ns-color-border-default" value="var(--ns-color-border-default)" />
        <ColorSwatch name="--ns-color-border-subtle" value="var(--ns-color-border-subtle)" />
        <ColorSwatch name="--ns-color-border-strong" value="var(--ns-color-border-strong)" />
        <ColorSwatch name="--ns-color-border-focus" value="var(--ns-color-border-focus)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Spacing">
      <SpacingSample name="--ns-space-1" size="0.25rem" />
      <SpacingSample name="--ns-space-2" size="0.5rem" />
      <SpacingSample name="--ns-space-3" size="0.75rem" />
      <SpacingSample name="--ns-space-4" size="1rem" />
      <SpacingSample name="--ns-space-5" size="1.25rem" />
      <SpacingSample name="--ns-space-6" size="1.5rem" />
      <SpacingSample name="--ns-space-8" size="2rem" />
    </TokenGroup>

    <TokenGroup title="Border Radius">
      <TokenGrid>
        <RadiusSample name="--ns-radius-sm" size="0.25rem" />
        <RadiusSample name="--ns-radius-md" size="0.5rem" />
        <RadiusSample name="--ns-radius-lg" size="0.75rem" />
        <RadiusSample name="--ns-radius-xl" size="1rem" />
        <RadiusSample name="--ns-radius-2xl" size="1.5rem" />
        <RadiusSample name="--ns-radius-full" size="9999px" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Shadows">
      <TokenGrid>
        <ShadowSample name="--ns-shadow-xs" value="var(--ns-shadow-xs)" />
        <ShadowSample name="--ns-shadow-sm" value="var(--ns-shadow-sm)" />
        <ShadowSample name="--ns-shadow-md" value="var(--ns-shadow-md)" />
        <ShadowSample name="--ns-shadow-lg" value="var(--ns-shadow-lg)" />
        <ShadowSample name="--ns-shadow-xl" value="var(--ns-shadow-xl)" />
      </TokenGrid>
    </TokenGroup>

    <TokenGroup title="Typography">
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            fontFamily: 'var(--ns-font-family-sans)',
            fontSize: 'var(--ns-font-size-xl)',
            fontWeight: 700
          }}
        >
          Sans-serif (Inter Variable)
        </div>
        <code style={{ fontSize: 11, color: 'var(--ns-color-text-subtle)' }}>
          --ns-font-family-sans
        </code>
      </div>
      <div>
        <div
          style={{ fontFamily: 'var(--ns-font-family-mono)', fontSize: 'var(--ns-font-size-base)' }}
        >
          Monospace (JetBrains Mono)
        </div>
        <code style={{ fontSize: 11, color: 'var(--ns-color-text-subtle)' }}>
          --ns-font-family-mono
        </code>
      </div>
    </TokenGroup>
  </div>
);

const meta: Meta = {
  title: 'Design System/Tokens',
  component: DesignTokensDoc,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
## Design Token System

NostrStack uses a W3C DTCG-compliant token system for consistent design across all packages.

### Usage

\`\`\`css
/* Direct CSS */
.my-element {
  background: var(--ns-color-primary-default);
  padding: var(--ns-space-4);
  border-radius: var(--ns-radius-lg);
}
\`\`\`

\`\`\`tsx
/* React inline styles */
<div style={{
  background: 'var(--ns-color-primary-default)',
  padding: 'var(--ns-space-4)',
  borderRadius: 'var(--ns-radius-lg)'
}} />
\`\`\`

### Package

Import tokens CSS in your app:

\`\`\`ts
import '@nostrstack/tokens/css';
\`\`\`
        `
      }
    }
  }
};

export default meta;

type Story = StoryObj;

export const Overview: Story = {};
