# Gallery demo

React/Vite demo that exercises the embed widgets.

## Playwright

- Mock flows (default): `pnpm --filter gallery exec playwright test tests/demo-flows.spec.ts`
- Regtest smoke (real invoices + real Nostr relays): start the regtest stack (`docker compose -f deploy/regtest/docker-compose.yml up`), then run  
  `REGTEST_SMOKE=true REAL_RELAY=wss://relay.damus.io VITE_ENABLE_TEST_SIGNER=true pnpm --filter gallery exec playwright test tests/demo-regtest.spec.ts`
- Optional real-relay comment check (no extension needed): `RUN_REAL_RELAY=true REAL_RELAY=wss://relay.damus.io pnpm --filter gallery exec playwright test tests/comment-relay.spec.ts`

Notes:

- The built-in Nostr test signer can be toggled in the UI Config card or via `VITE_ENABLE_TEST_SIGNER=true`. It uses the key in `VITE_TEST_SIGNER_SK` (test-only).
- Relay selection is in the Config card; use the presets or pass `VITE_NOSTRSTACK_RELAYS`.
