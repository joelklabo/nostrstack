# @nostrstack/react

React components for embedding nostrstack widgets (tips, comments, share-to-Nostr) into your app.

## Install

```bash
pnpm add @nostrstack/react
```

## Usage

```tsx
import {
  Comments,
  NostrstackProvider,
  ShareButton,
  TipButton,
  SupportSection,
  BlockchainStats,
  NostrProfileWidget
} from '@nostrstack/react';

export function PostWidgets({
  url,
  title,
  lnAddress,
  itemId
}: {
  url: string;
  title: string;
  lnAddress: string;
  itemId: string;
}) {
  return (
    <NostrstackProvider
      lnAddress={lnAddress}
      relays={['wss://relay.damus.io', 'wss://relay.snort.social']}
      baseUrl="https://your-nostrstack-api.example"
      host="your-nostrstack-api.example"
    >
      {/* High-level composed section */}
      <SupportSection itemId={itemId} shareUrl={url} shareTitle={title} />

      {/* Individual widgets */}
      <div className="grid">
        <BlockchainStats title="Network Status" />
        <NostrProfileWidget identifier={lnAddress} />
      </div>
    </NostrstackProvider>
  );
}
```

## Components

### Composed

- **`SupportSection`**: Combines tips, sharing, and comments into a responsive grid. Handles layout modes (`full` or `compact`).

### Individual

- **`Comments`**: Nostr-powered comment thread.
- **`TipWidget`**: Tip interface with presets and activity feed.
- **`CommentTipWidget`**: React wrapper for the `@nostrstack/widgets` support grid.
- **`BlockchainStats`**: Live Bitcoin network statistics.
- **`NostrProfileWidget`**: Profile card for any pubkey or NIP-05.
- **`ShareButton`**: One-click sharing to Nostr.
- **`TipButton`**: Simplified tip button.

## Theming

`NostrstackProvider` renders a wrapper with `.ns-theme` and sets `--ns-*` CSS variables (compatible with `@nostrstack/tokens`).

### Quick presets

```tsx
<NostrstackProvider brandPreset="emerald" themeMode="dark">
  {/* widgets */}
</NostrstackProvider>
```

### Full control

```tsx
<NostrstackProvider
  nsTheme={{
    mode: 'light',
    color: { primary: 'oklch(0.58 0.22 250)', accent: 'oklch(0.65 0.2 290)' },
    radius: { md: '0.5rem', full: '9999px' }
  }}
>
  {/* widgets */}
</NostrstackProvider>
```

## Helpers

- `parseLnAddress(lnAddress)` -> `{ username, domain }`
- `parseRelays(csv)` -> `string[]`
