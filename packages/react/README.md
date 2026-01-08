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

export function PostWidgets({ url, title, lnAddress, itemId }: { url: string; title: string; lnAddress: string; itemId: string }) {
  return (
    <NostrstackProvider
      lnAddress={lnAddress}
      relays={['wss://relay.damus.io', 'wss://relay.snort.social']}
      baseUrl="https://your-nostrstack-api.example"
      host="your-nostrstack-api.example"
    >
      {/* High-level composed section */}
      <SupportSection 
        itemId={itemId}
        shareUrl={url}
        shareTitle={title}
      />

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

`NostrstackProvider` renders a wrapper with `.nostrstack-theme` and sets `--nostrstack-*` CSS variables (compatible with `@nostrstack/widgets` tokens).

### Quick presets

```tsx
<NostrstackProvider brandPreset="emerald" themeMode="dark">
  {/* widgets */}
</NostrstackProvider>
```

### Full control

```tsx
<NostrstackProvider
  nostrstackTheme={{
    mode: 'light',
    color: { primary: '#0ea5e9', accent: '#a78bfa' },
    radius: { md: '12px', pill: '999px' }
  }}
>
  {/* widgets */}
</NostrstackProvider>
```

### Legacy theme props (v1)

If you’re upgrading from older integrations, `theme={{ accent, text, surface, border }}` is still supported and mapped to the new tokens. Legacy `--ns-*` CSS vars are also provided as aliases.

## Helpers

- `parseLnAddress(lnAddress)` → `{ username, domain }`
- `parseRelays(csv)` → `string[]`
