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

## Module usage
```ts
import { mountTipButton, mountPayToAction, mountCommentWidget } from '@nostrstack/embed';

const tipBtn = mountTipButton(container, { username: 'alice', amountSats: 5 });
const payBtn = mountPayToAction(container, { username: 'alice', amountSats: 10, onUnlock: () => console.log('paid') });
mountCommentWidget(container, { threadId: 'post-123' });
```

## UI building blocks
All of these are exported from `@nostrstack/embed` for reuse in other apps:

- `renderInvoicePopover(pr: string)` – show a lightweight lightning invoice popover.
- `renderRelayBadge({ relays, mode })` + `updateRelayBadge` – badge/pill with live status dot.
- `renderNostrUserCard(pubkey, opts)` – simple profile card (name, about, picture if available).
- `designTokens` – shared spacing, color, radius, and typography tokens.

Example:
```ts
import { renderRelayBadge, designTokens } from '@nostrstack/embed';

const badge = renderRelayBadge({ relays: ['wss://relay.damus.io'], mode: 'real' });
badge.style.margin = designTokens.spacing.sm;
document.body.appendChild(badge);
```

## Nostr comments
Requires a NIP-07 signer in the browser. For live relay subscriptions, expose `window.NostrTools.relayInit` (optional); otherwise comments still post via the signer only.
