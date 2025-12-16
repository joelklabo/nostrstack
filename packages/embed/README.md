# @nostrstack/embed

Embeddable widgets (tip, pay-to-action, comments) for nostrstack.

## Install

```sh
npm install @nostrstack/embed
# or
pnpm add @nostrstack/embed
```

## Script-tag usage

```html
<script src="https://unpkg.com/@nostrstack/embed/dist/index.global.js"></script>
<div data-nostrstack-tip="alice" data-label="Send sats"></div>
<div data-nostrstack-pay="alice" data-label="Unlock"></div>
<div data-nostrstack-comments="post-123"></div>
```

Widgets auto-mount on elements with `data-nostrstack-*` attributes.

To opt into the newer tip widget (3 presets + custom + live activity), add an `itemId`:

```html
<div
  data-nostrstack-tip="alice"
  data-item-id="post-123"
  data-preset-amounts-sats="5,10,21"
  data-default-amount-sats="10"
  data-label="Tip"
></div>
```

## Module usage

```ts
import { mountTipButton, mountTipWidget, mountTipFeed, mountPayToAction, mountCommentWidget } from '@nostrstack/embed';

const tipBtn = mountTipButton(container, { username: 'alice', amountSats: 5 });
// Tip widget (includes built-in activity feed by default).
const tipWidget = mountTipWidget(container, { username: 'alice', itemId: 'post-123', presetAmountsSats: [5, 10, 21] });
// Standalone feed (optional).
mountTipFeed(feedContainer, { itemId: 'post-123' });
const payBtn = mountPayToAction(container, { username: 'alice', amountSats: 10, onUnlock: () => console.log('paid') });
mountCommentWidget(container, { threadId: 'post-123' });
```

## `baseURL` (important)

`baseURL` should point to the **nostrstack server origin** (not the `/api` prefix).

- ✅ `baseURL: "https://api.example.com"`
- ✅ `baseURL: ""` (use the current origin; great for local dev proxies)
- ⚠️ `baseURL: "/api"` is treated as “same-origin” for dev convenience (to avoid `/api/api/*` footguns)

## UI building blocks

All of these are exported from `@nostrstack/embed` for reuse in other apps:

- `renderInvoicePopover(pr: string)` – show a lightweight lightning invoice popover.
- `renderRelayBadge({ relays, mode })` + `updateRelayBadge` – badge/pill with live status dot.
- `renderNostrUserCard(pubkey, opts)` – simple profile card (name, about, picture if available).
- `applyNostrstackTheme(el, theme)` + `createNostrstackBrandTheme({ preset, mode })` – theme any container via CSS variables.
- `designTokens` – shared spacing, color, radius, and typography tokens.

Example:
```ts
import { renderRelayBadge, designTokens } from '@nostrstack/embed';

const badge = renderRelayBadge({ relays: ['wss://relay.damus.io'], mode: 'real' });
badge.style.margin = designTokens.spacing.sm;
document.body.appendChild(badge);
```

## Theming

Set the theme mode (light/dark) and optionally override brand colors.

```ts
import { applyNostrstackTheme, createNostrstackBrandTheme, themeToCss, themeToCssVars } from '@nostrstack/embed';

// Apply an "emerald" brand preset in dark mode.
applyNostrstackTheme(container, createNostrstackBrandTheme({ preset: 'emerald', mode: 'dark' }));

// Or generate from hues (0-359).
applyNostrstackTheme(container, createNostrstackBrandTheme({ primaryHue: 210, accentHue: 300, mode: 'light' }));

// Or generate CSS to copy/paste into your stylesheet.
const theme = createNostrstackBrandTheme({ preset: 'emerald', mode: 'dark' });
const css = themeToCss(theme); // targets `.nostrstack-theme[data-nostrstack-theme="dark"]`
const vars = themeToCssVars(theme); // { "--nostrstack-color-primary": "...", ... }
```

Copy/paste example:
```css
.nostrstack-theme[data-nostrstack-theme="dark"] {
  --nostrstack-color-accent: hsl(210 85% 72%);
  --nostrstack-color-accent-soft: hsl(210 84% 28% / 0.55);
  --nostrstack-color-primary: hsl(157 86% 62%);
  --nostrstack-color-primary-soft: hsl(157 80% 22% / 0.7);
  --nostrstack-color-primary-strong: hsl(157 88% 72%);
  --nostrstack-color-ring: hsl(157 88% 65% / 0.45);
  --nostrstack-shadow-glow: 0 0 0 1px hsl(157 88% 65% / 0.18), var(--nostrstack-shadow-lg);
}
```

## Nostr comments

Requires a NIP-07 signer in the browser. For live relay subscriptions, expose `window.NostrTools.relayInit` (optional); otherwise comments still post via the signer only.
