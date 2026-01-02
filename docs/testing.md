# Testing matrix

## Regtest/local
- Run API unit + Playwright: `NODE_OPTIONS=--no-experimental-strip-types pnpm --filter api test` and `pnpm --filter api test:e2e`.
- Pay-to-act suite (SQLite): `NODE_OPTIONS=--no-experimental-strip-types DATABASE_URL=file:./test-e2e.db pnpm --filter api test:e2e:pay`.
- Regtest zap UI: start API with `ENABLE_REGTEST_PAY=true` and gallery with `VITE_ENABLE_REGTEST_PAY=true`, then run `pnpm qa:regtest-demo`.

## Gallery UI QA (network switching)
- Start logs: `pnpm dev:logs` (or `tail -f .logs/dev/api.log .logs/dev/gallery.log`).
- DevTools MCP: `./scripts/mcp-devtools-server.sh` + `./scripts/mcp-chrome.sh`, open `/personal-site-kit`, verify console + network clean.
- Playwright: `pnpm --filter gallery e2e tests/bitcoin-network-status.spec.ts` (or full suite with `pnpm --filter gallery e2e`).
- Fallback if MCP unavailable: `pnpm qa:regtest-demo`.

## Mutinynet (staging LNbits)
- Env needed:
  - `LNBITS_URL=https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io`
  - `LNBITS_ADMIN_KEY` (payer wallet key)
  - `LNBITS_STG_ADMIN_KEY` (admin wallet for smoke; in KV value `79572e2910384c3293bc798028e01707`)
- Smoke: `LNBITS_URL=... LNBITS_ADMIN_KEY=... ./scripts/lnbits-smoke.sh 100`
- Pay-to-act E2E with settlement: set `LNBITS_URL` and `LNBITS_ADMIN_KEY`, then `pnpm --filter api test:e2e:pay` (payer test will run and assert balance delta).

## CI secrets required
- `LNBITS_STG_ADMIN_KEY` (staging admin key) — enables mutinynet smoke step.
- Optional: `LNBITS_URL`, `LNBITS_ADMIN_KEY` — enables payer/balance assertions and real-payment gallery flows.

## Gallery real-payments
- Set `VITE_API_BASE_URL` to the API origin and `VITE_NOSTRSTACK_HOST` to the embed host (e.g., `lnbits-stg-west...`). Real invoices are always enabled.
- For regtest zap payments, also set `VITE_ENABLE_REGTEST_PAY=true` and ensure the API has `ENABLE_REGTEST_PAY=true`.
