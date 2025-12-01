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

## Nostr comments
Requires a NIP-07 signer in the browser. For live relay subscriptions, expose `window.NostrTools.relayInit` (optional); otherwise comments still post via Nostr signer.
