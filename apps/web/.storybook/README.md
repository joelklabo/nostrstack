# Storybook for NostrStack Web

This directory contains Storybook configuration and stories for the NostrStack web UI components.

## Overview

Storybook is used to develop, test, and document UI components in isolation. We have 70+ stories covering:

- **UI Components**: Image, BitcoinNodeCard, ProfileLink, FindFriendCard, NotificationItem, OnboardingTour, etc.
- **Payment Components**: PaymentModal, ZapButton, SendSats (from `@nostrstack/react`)
- **Nostr Components**: PostEditor, ReplyModal, ReactionButton (from `@nostrstack/react`)

## Running Storybook

### Development Mode

```bash
# From the monorepo root
pnpm --filter web storybook

# Or from apps/web
cd apps/web
pnpm storybook
```

This starts the Storybook dev server at `http://localhost:6006`.

### Build Static Storybook

```bash
# From the monorepo root
pnpm --filter web build-storybook

# Or from apps/web
cd apps/web
pnpm build-storybook
```

The static build is output to `apps/web/storybook-static/`.

## Writing Stories

Stories follow the CSF 3.0 (Component Story Format) standard. Example:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta = {
  title: 'Category/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered' // or 'fullscreen', 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' }
  }
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Click me'
  }
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true
  }
};
```

### Best Practices

1. **Comprehensive coverage**: Cover happy path, error states, edge cases, and accessibility scenarios
2. **Isolated**: Mock dependencies (auth context, config, API calls) to keep stories independent
3. **Named exports**: Use descriptive names (e.g., `Default`, `Loading`, `Error`, `EmptyState`)
4. **Decorators**: Use decorators to provide required context (auth, config, layout)
5. **Interactive demos**: Use `render` functions for complex interactive scenarios

### Mock Context Providers

Many components require auth or config context. Mock these in decorators:

```typescript
import { AuthProvider } from '@nostrstack/react/auth';
import { NostrstackConfigProvider } from '@nostrstack/react/context';

const mockAuthContext = {
  pubkey: 'cafe1234...',
  signEvent: async (template) => ({ ...template, id: '...', sig: '...' })
};

const mockConfig = {
  relays: ['wss://relay.damus.io'],
  apiBase: 'https://api.nostrstack.com'
};

const meta = {
  // ...
  decorators: [
    (Story) => (
      <AuthProvider value={mockAuthContext}>
        <NostrstackConfigProvider value={mockConfig}>
          <Story />
        </NostrstackConfigProvider>
      </AuthProvider>
    )
  ]
};
```

## Addons

The following Storybook addons are configured:

- **@storybook/addon-essentials**: Core addons (controls, actions, viewport, backgrounds, etc.)
- **@storybook/addon-a11y**: Accessibility testing (WCAG compliance checks)
- **@storybook/addon-vitest**: In-browser component testing with Vitest
- **@storybook/addon-onboarding**: First-time user onboarding guide

## Troubleshooting

### Build Failures

**Issue**: Storybook build fails with `@storybook/test` import errors

**Solution**: Don't use `fn()` from `@storybook/test` (not available in Storybook 10.1.11). Use plain functions or action callbacks instead:

```typescript
// ❌ Don't do this
import { fn } from '@storybook/test';
const meta = {
  argTypes: { onClick: { action: 'clicked' } }
};
export const Default: Story = {
  args: { onClick: fn() }
};

// ✅ Do this instead
const meta = {
  argTypes: { onClick: { action: 'clicked' } }
};
export const Default: Story = {
  args: { onClick: () => console.log('clicked') }
};
```

### Missing Context

**Issue**: Components fail to render with "cannot read property of undefined" errors

**Solution**: Wrap stories with required context providers (AuthProvider, NostrstackConfigProvider) using decorators.

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [CSF 3.0 Format](https://storybook.js.org/docs/writing-stories/introduction)
- [Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)
