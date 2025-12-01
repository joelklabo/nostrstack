# Testing matrix

## Regtest/local
- Run API unit + Playwright: `NODE_OPTIONS=--no-experimental-strip-types pnpm --filter api test` and `pnpm --filter api test:e2e`.
- Pay-to-act suite (SQLite): `NODE_OPTIONS=--no-experimental-strip-types DATABASE_URL=file:./test-e2e.db pnpm --filter api test:e2e:pay`.

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
- Set `VITE_API_BASE_URL` to the API origin, `VITE_SATOSHIS_HOST` to embed host (e.g., `lnbits-stg-west...`), and `VITE_ENABLE_REAL_PAYMENTS=true` to show real invoice requests. Without these, gallery uses mocks but e2e still pass.
