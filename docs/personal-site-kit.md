# Personal Site Kit

The Personal Site Kit provides a set of high-level components and embeddable widgets to easily add Lightning tips, Nostr comments, sharing, profile sections, and blockchain stats to any personal site or blog.

## Components

The kit includes the following widgets:

- **Lightning Tips**: Accept tips in sats with customizable presets and real-time activity feed.
- **Nostr Comments**: Host decentralized comments powered by Nostr relays.
- **Share to Nostr**: One-click sharing of your content to the Nostr network.
- **Nostr Profile**: Display your Nostr profile metadata (name, about, picture).
- **Blockchain Stats**: Show live Bitcoin network stats (height, fee rates).
- **SupportSection**: A pre-composed layout grouping tips, sharing, and comments.

## Integration Options

### 1. React (SDK)

If you are using React, install `@nostrstack/react`:

```bash
npm install @nostrstack/react
```

Wrap your app in `NostrstackProvider`:

```tsx
import { NostrstackProvider } from '@nostrstack/react';

function App({ children }) {
  return (
    <NostrstackProvider
      lnAddress="alice@example.com"
      relays={['wss://relay.damus.io', 'wss://nos.lol']}
    >
      {children}
    </NostrstackProvider>
  );
}
```

Use the `SupportSection` component at the end of your posts:

```tsx
import { SupportSection } from '@nostrstack/react';

function Post({ id, title }) {
  return (
    <article>
      <h1>{title}</h1>
      {/* ... content ... */}
      <SupportSection
        itemId={id}
        title="Support this post"
        layout="full" // or "compact"
      />
    </article>
  );
}
```

### 2. Static Script (Embed)

For static sites (Hugo, Jekyll, 11ty, etc.), include the `@nostrstack/widgets` script:

```html
<script src="https://cdn.jsdelivr.net/npm/@nostrstack/widgets/dist/index.global.js"></script>
```

Add data attributes to any container to mount a widget:

#### Support Grid (Tips + Comments)

```html
<div data-nostrstack-comment-tip="post-123" data-tip-username="alice" data-host="example.com"></div>
```

#### Individual Widgets

```html
<!-- Tip Widget -->
<div data-nostrstack-tip data-tip-username="alice" data-item-id="post-123"></div>

<!-- Comments -->
<div data-nostrstack-comments="post-123"></div>

<!-- Blockchain Stats -->
<div data-nostrstack-blockchain data-title="Network Status"></div>

<!-- Nostr Profile -->
<div data-nostrstack-profile="alice@example.com"></div>
```

## Configuration

| Attribute / Prop | Description                 | Default                  |
| ---------------- | --------------------------- | ------------------------ |
| `itemId`         | Unique ID for the post/page | URL path                 |
| `lnAddress`      | Lightning address for tips  | Config default           |
| `relays`         | List of Nostr relays        | Config default           |
| `layout`         | `full` or `compact`         | `full`                   |
| `baseUrl`        | API base URL for telemetry  | `https://localhost:3001` |

## CSP & CORS Guidance

To allow the widgets to function correctly, ensure your Content Security Policy (CSP) permits:

- `script-src`: The CDN hosting the embed script.
- `connect-src`: Your API base URL and the configured Nostr relays (WebSockets).
- `img-src`: `https://*` (for Nostr profile pictures).

## Privacy & Telemetry

The Blockchain Stats and Tip Feed widgets use a telemetry API to fetch real-time data. This API is privacy-preserving:

- No visitor IP addresses are logged.
- No tracking cookies are set.
- Telemetry is limited to public blockchain data and voluntary payment notifications.
