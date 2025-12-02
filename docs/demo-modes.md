# Demo modes

Phased approach with three presets that all support tip, paywall, and comments.

## 1) Regtest (real Nostr)
- One command: `pnpm demo:regtest`
- Starts colima/docker, bitcoind + two LNDs + LNbits, Postgres (localhost:65432), API (:3001), gallery (:4173).
- Output prints LNbits admin key, URLs, relays.

## 2) Mutinynet (real Nostr)
- One command: `pnpm demo:mutinynet`
- Required env: `LN_BITS_URL`, `LN_BITS_API_KEY`; optional `VITE_NOSTRSTACK_RELAYS` (default damus).
- Starts Postgres, runs migrations, launches API/gallery with those endpoints.
- Smoke (no payment settlement): `pnpm smoke:mutinynet-demo` (expects API running).

## 3) Mainnet (real Nostr)
- Gated preset (WIP):
  - Requires explicit `MAINNET_DEMO_OK=true`.
  - Expects prod LNbits URL/key and prod relays list.
  - Will refuse to start if envs missing or if health checks fail.
  - Adds confirmation banner in gallery and disables built-in test signer.

Common:
- Smoke: `pnpm smoke:regtest-demo` (regtest). Mutinynet/mainnet smoke TODO.
- Mainnet is gated by `MAINNET_DEMO_OK=true` and requires real LNbits URL/key and relays; built-in test signer is disabled.
- Logs: `/tmp/nostrstack-api.log`, `/tmp/nostrstack-gallery.log`.
