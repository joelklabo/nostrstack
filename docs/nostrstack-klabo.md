# Integrate nostrstack into klabo.world

This guide walks through wiring nostrstack tips, Nostr comments, and share-to-Nostr into the klabo.world Next.js blog. It covers env setup, feature flags, widget mounting, static-site injection, and mock/dev flows.

## Prerequisites
- nostrstack repo (API + embed) available; embed CDN (default unpkg) or your own host.
- klabo.world repo checked out with Node 24.x/pnpm 10.x.
- For real payments: LNbits or OpenNode keys in nostrstack; otherwise use mock mode.

## Environment
Set these in klabo.world (e.g., `.env.local`):

```
FEATURE_FLAGS_JSON={"nostrstack-post-widgets":true}
NOSTRSTACK_BASE_URL=https://<nostrstack-api-host>
NOSTRSTACK_HOST=<nostrstack-api-host>
NOSTRSTACK_RELAYS=wss://relay.damus.io,wss://relay.snort.social
NOSTRSTACK_LN_ADDRESS=<lnaddr@domain>
```

Optional theming (used by embed config endpoint):
```
NOSTRSTACK_THEME_ACCENT=#f59e0b
NOSTRSTACK_THEME_TEXT=#0f172a
NOSTRSTACK_THEME_SURFACE=#f8fafc
NOSTRSTACK_THEME_BORDER=#e2e8f0
```

Dev/mock mode (no real keys):
```
NOSTRSTACK_BASE_URL=mock
NOSTRSTACK_HOST=mock
NOSTRSTACK_RELAYS=mock
LIGHTNING_PROVIDER=mock            # in nostrstack API
DEV_MOCKS=true                     # nostrstack API embed-config
```

## Data model additions
Posts now support nostrstack frontmatter fields (Contentlayer):
- `lightningAddress`
- `nostrPubkey`
- `nostrRelays`
- `nostrstackEnabled` (boolean)

Admin compose/edit forms expose these fields; per-post disable is respected even if the flag is on.

## Runtime wiring (klabo.world)
- Post page (`app/src/app/posts/[slug]/page.tsx`) renders `SupportSection` (tips/share/comments) when flag `nostrstack-post-widgets` is true and post not disabled.
- Sidebar or footer can render `BlockchainStats` and `NostrProfile` for global status and identity.
- Widgets read env fallbacks when frontmatter is missing and build canonical URL for Nostr share.
- Client component `app/src/components/nostrstack-widgets.tsx` handles mock mode (stub invoices, local comments) and dynamic nostr-tools import.

## React blog kit
- `@nostrstack/blog-kit` exposes `NostrstackProvider`, `SupportSection`, `BlockchainStats`, `NostrProfileWidget`, plus individual widgets (`TipWidget`, `Comments`, `ShareButton`).
- Use when embedding widgets into other React blogs: wrap layout with `NostrstackProvider` and drop components where needed.

### Theming (blog-kit)
Quick preset:
```tsx
<NostrstackProvider brandPreset="emerald" themeMode="dark">
  {/* widgets */}
</NostrstackProvider>
```

Full control:
- Pass `nostrstackTheme` (uses `@nostrstack/embed` tokens).
- Or set `--nostrstack-*` CSS vars on a wrapping selector (the provider renders `.nostrstack-theme`).

## Static-site injector
- CLI `pnpm nostrstack inject -i dist -t alice@your.host -a https://api.host -r wss://relay1,wss://relay2` adds embed script + tip/comments placeholders to static HTML/MDX outputs (Hugo/Jekyll/etc.). Idempotent via markers.
- New flags:
  - `--with-blockchain`: Add blockchain stats to the footer.
  - `--with-profile`: Add your Nostr profile section.
  - `--layout [full|compact]`: Set the default SupportSection layout.

## Embed config endpoint (nostrstack API)
- `GET /embed-config?tenant=<name>` returns lnAddress, relays, embedScript URL, apiBase, theme. Honors `DEV_MOCKS=true` by returning `mock` base/relays for offline dev.

## Testing
- App e2e: `pnpm --filter app exec playwright test tests/e2e/nostrstack.e2e.ts --project=chromium` (uses mock mode; passes without keys).
- Embed package: `pnpm --filter embed test`.
- API: `pnpm --filter api test` (includes embed-config test and mock provider).

## Troubleshooting
- **No invoice shown**: ensure `NOSTRSTACK_BASE_URL/HOST` set; in mock mode invoices still generate stub `lnbc1mock...` values.
- **Comments not posting**: need NIP-07 signer unless `NOSTRSTACK_RELAYS=mock`; also check relays reachable.
- **Flag disabled**: `FEATURE_FLAGS_JSON` must set `nostrstack-post-widgets` true or configure Redis flag.
- **Static inject skipped**: injector adds markers; delete marker block and rerun if you need to re-inject.
