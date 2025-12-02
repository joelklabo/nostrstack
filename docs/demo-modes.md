# Demo modes (Concept A)

## Lightning tab
- Tip & Paywall use animated QR popover (copy, lightning: link, status text).
- Regtest faucet button calls `/regtest/fund` (TS service).
- Network badge shows VITE_NETWORK (regtest/mutinynet/mainnet).
- Status card with pulsing badges; TelemetryCard placeholder (blocks + node URI/IP).

## Nostr tab
- Profile card with avatar/name/about placeholder, signer status badge, NPUB/NSEC toggle.
- Relay selector with add button; relay badge pulses (mock/real).
- Comments widget mounts with relays set.

## Commands
- Regtest: `pnpm demo:regtest`
- Mutinynet: `pnpm demo:mutinynet` (set LN_BITS_URL/LN_BITS_API_KEY)
- Mainnet (gated): `MAINNET_DEMO_OK=true pnpm demo:mainnet`
- Smokes: `pnpm smoke:regtest-demo`, `pnpm smoke:mutinynet-demo`
- Playwright: `pnpm --filter gallery exec playwright test tests/demo-flows.spec.ts` (some embed/relay tests currently skipped)

## Reusable components
- `InvoicePopover` (QR + status) – import from gallery src.
- `FaucetButton` – triggers regtest fund API.
- `TelemetryCard` – WS feed for block/node info (expandable).
- `NostrProfileCard`, `KeyToggle`, `Nip07Status` – signer/profile UI with npub/nsec toggles.
