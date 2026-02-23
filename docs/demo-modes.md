# Demo modes (Concept A)

## Lightning tab
- Tip & Paywall use animated QR popover (copy, lightning: link, status text).
- Regtest faucet button calls `/api/regtest/fund` (TS service).
- Regtest zap pay uses `/api/regtest/pay` and requires `ENABLE_REGTEST_PAY=true` (API) + `VITE_ENABLE_REGTEST_PAY=true` (web).
- Network badge shows configured network (BITCOIN_NETWORK/VITE_NETWORK) plus telemetry source (bitcoind/esplora/mock) with a mainnet warning.
- Status card reads `/api/bitcoin/status` for tip height, sync/IBD, mempool stats, and Lightning provider health.

## Nostr tab
- Profile card with avatar/name/about placeholder, signer status badge, NPUB/NSEC toggle.
- Relay selector with add button; relay badge pulses (mock/real).
- Comments widget mounts with relays set.

## Commands
- Regtest: `pnpm demo:regtest`
- Mutinynet: `pnpm demo:mutinynet` (set LN_BITS_URL/LN_BITS_API_KEY)
- Mainnet (gated): `MAINNET_DEMO_OK=true pnpm demo:mainnet`
- Local switch: `pnpm dev:network -- --network regtest|mutinynet|mainnet`
- Smokes: `pnpm smoke:regtest-demo`, `pnpm smoke:mutinynet-demo`
- Playwright: `pnpm --filter web exec playwright test tests/demo-flows.spec.ts` (some embed/relay tests currently skipped)

## Reusable components
- `InvoicePopover` (QR + status) – import from web src.
- `FaucetButton` – triggers regtest fund API.
- `TelemetryCard` – WS feed for block/node info (expandable).
- `NostrProfileCard`, `KeyToggle`, `Nip07Status` – signer/profile UI with npub/nsec toggles.
