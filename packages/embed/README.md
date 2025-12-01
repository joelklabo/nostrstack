# @satoshis/embed

Embeddable widgets (tip, pay-to-action, comments) for nostrstack.

## Install
```sh
npm install @satoshis/embed
# or
pnpm add @satoshis/embed
```

## Script-tag usage
```html
<script src="https://unpkg.com/@satoshis/embed/dist/index.global.js"></script>
<div data-satoshis-tip="alice" data-label="Send sats"></div>
<div data-satoshis-pay="alice" data-label="Unlock"></div>
<div data-satoshis-comments="post-123"></div>
```
Widgets auto-mount on elements with `data-satoshis-*` attributes.

## Module usage
```ts
import { mountTipButton, mountPayToAction, mountCommentWidget } from '@satoshis/embed';

const tipBtn = mountTipButton(container, { username: 'alice', amountSats: 5 });
const payBtn = mountPayToAction(container, { username: 'alice', amountSats: 10, onUnlock: () => console.log('paid') });
mountCommentWidget(container, { threadId: 'post-123' });
```

## Nostr comments
Requires a NIP-07 signer in the browser. For live relay subscriptions, expose `window.NostrTools.relayInit` (optional); otherwise comments still post via Nostr signer.
