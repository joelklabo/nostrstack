# @nostrstack/blog-kit

React components for embedding nostrstack widgets (tips, comments, share-to-Nostr) into your app.

## Install

```bash
pnpm add @nostrstack/blog-kit
```

## Usage

```tsx
import { Comments, NostrstackProvider, ShareButton, TipButton } from '@nostrstack/blog-kit';

export function PostWidgets({ url, title, lnAddress, threadId }: { url: string; title: string; lnAddress: string; threadId: string }) {
  return (
    <NostrstackProvider
      lnAddress={lnAddress}
      relays={['wss://relay.damus.io', 'wss://relay.snort.social']}
      baseUrl="https://your-nostrstack-api.example"
      host="your-nostrstack-api.example"
    >
      <TipButton label="Send sats" />
      <ShareButton url={url} title={title} lnAddress={lnAddress} />
      <Comments threadId={threadId} />
    </NostrstackProvider>
  );
}
```

## Theming

`NostrstackProvider` renders a wrapper with `.nostrstack-theme` and sets `--nostrstack-*` CSS variables (compatible with `@nostrstack/embed` tokens).

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

