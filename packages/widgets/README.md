# @nostrstack/widgets

Embeddable widgets (tip, pay-to-action, comments) for nostrstack.

## Install

```sh
npm install @nostrstack/widgets
# or
pnpm add @nostrstack/widgets
```

## Script-tag usage

```html
<script src="https://unpkg.com/@nostrstack/widgets/dist/index.global.js"></script>
<div data-ns-tip="alice" data-label="Send sats"></div>
<div data-ns-pay="alice" data-label="Unlock"></div>
<div data-ns-comments="post-123"></div>
<div data-ns-comment-tip="post-123" data-tip-username="alice"></div>
<div data-ns-blockchain data-title="Bitcoin"></div>
<div data-ns-profile="alice@example.com"></div>
<div data-ns-share-button data-url="https://example.com" data-title="Post Title"></div>
```

Widgets auto-mount on elements with `data-ns-*` attributes.

### Personal Site Kit Widgets

- **Support Grid (`data-ns-comment-tip`)**: Combines tips and comments into a single responsive layout.
- **Blockchain Stats (`data-ns-blockchain`)**: Live height and fee rates.
- **Nostr Profile (`data-ns-profile`)**: Display profile metadata for any pubkey or lightning address.
- **Share to Nostr (`data-ns-share-button`)**: One-click sharing with Web Share API fallback.

To opt into the newer tip widget (3 presets + custom + live activity), add an `itemId`:

```html
<div
  data-ns-tip="alice"
  data-item-id="post-123"
  data-preset-amounts-sats="5,10,21"
  data-default-amount-sats="10"
  data-label="Tip"
></div>
```

## Module usage

```ts
import {
  mountTipButton,
  mountTipWidget,
  mountTipFeed,
  mountPayToAction,
  mountCommentWidget,
  mountCommentTipWidget,
  mountBlockchainStats,
  mountNostrProfile,
  mountShareButton
} from '@nostrstack/widgets';

const tipBtn = mountTipButton(container, { username: 'alice', amountSats: 5 });
// Tip widget (includes built-in activity feed by default).
const tipWidget = mountTipWidget(container, {
  username: 'alice',
  itemId: 'post-123',
  presetAmountsSats: [5, 10, 21]
});
// Standalone feed (optional).
mountTipFeed(feedContainer, { itemId: 'post-123' });
const payBtn = mountPayToAction(container, {
  username: 'alice',
  amountSats: 10,
  onUnlock: () => console.log('paid')
});
mountCommentWidget(container, { threadId: 'post-123' });

// Personal Site Kit
mountCommentTipWidget(container, { itemId: 'post-123', username: 'alice' });
mountBlockchainStats(container, { title: 'Network' });
mountNostrProfile(container, { identifier: 'alice@example.com' });
mountShareButton(container, { url: 'https://example.com', title: 'Post' });
```

## `baseURL` (important)

`baseURL` should point to the **nostrstack server origin** (not the `/api` prefix).

- `baseURL: "https://api.example.com"`
- `baseURL: ""` (use the current origin; great for local dev proxies)
- `baseURL: "/api"` is treated as "same-origin" for dev convenience (to avoid `/api/api/*` footguns)

## UI building blocks

All of these are exported from `@nostrstack/widgets` for reuse in other apps:

- `renderInvoicePopover(pr: string)` - show a lightweight lightning invoice popover.
- `renderRelayBadge({ relays, mode })` + `updateRelayBadge` - badge/pill with live status dot.
- `renderNostrUserCard(pubkey, opts)` - simple profile card (name, about, picture if available).
- `applyNsTheme(el, theme)` + `createNsBrandTheme({ preset, mode })` - theme any container via CSS variables.

Example:

```ts
import { renderRelayBadge } from '@nostrstack/widgets';

const badge = renderRelayBadge({ relays: ['wss://relay.damus.io'], mode: 'real' });
badge.style.margin = '0.5rem';
document.body.appendChild(badge);
```

## Theming

Set the theme mode (light/dark) and optionally override brand colors.

```ts
import { applyNsTheme, createNsBrandTheme, themeToCss, themeToCssVars } from '@nostrstack/widgets';

// Apply an "emerald" brand preset in dark mode.
applyNsTheme(container, createNsBrandTheme({ preset: 'emerald', mode: 'dark' }));

// Or generate from hues (0-359).
applyNsTheme(container, createNsBrandTheme({ primaryHue: 210, accentHue: 300, mode: 'light' }));

// Or generate CSS to copy/paste into your stylesheet.
const theme = createNsBrandTheme({ preset: 'emerald', mode: 'dark' });
const css = themeToCss(theme); // targets `.ns-theme[data-ns-theme="dark"]`
const vars = themeToCssVars(theme); // { "--ns-color-primary-default": "...", ... }
```

Copy/paste example:

```css
.ns-theme[data-ns-theme='dark'] {
  --ns-color-accent-default: oklch(0.72 0.15 210);
  --ns-color-accent-subtle: oklch(0.28 0.1 210 / 0.55);
  --ns-color-primary-default: oklch(0.75 0.18 157);
  --ns-color-primary-subtle: oklch(0.22 0.08 157 / 0.7);
  --ns-color-primary-hover: oklch(0.82 0.2 157);
  --ns-color-focus-ring: oklch(0.78 0.18 157 / 0.45);
  --ns-effect-glow-primary: 0 0 0 1px oklch(0.78 0.18 157 / 0.18), var(--ns-shadow-lg);
}
```

## Nostr comments

Requires a NIP-07 signer in the browser. For live relay subscriptions, expose `window.NostrTools.relayInit` (optional); otherwise comments still post via the signer only.
