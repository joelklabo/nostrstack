# Testing matrix

## Regtest/local

- Run API unit + Playwright: `NODE_OPTIONS=--no-experimental-strip-types pnpm --filter api test` and `pnpm --filter api test:e2e`.
- Pay-to-act suite (SQLite): `NODE_OPTIONS=--no-experimental-strip-types DATABASE_URL=file:./test-e2e.db pnpm --filter api test:e2e:pay`.
- Regtest zap UI: start API with `ENABLE_REGTEST_PAY=true` and gallery with `VITE_ENABLE_REGTEST_PAY=true`, run `pnpm dev:logs`, then run `pnpm qa:regtest-demo` (set `GALLERY_URL` if using a custom host/port).

## Gallery UI QA (network switching)

- Start logs: `pnpm dev:logs` (or `tail -f .logs/dev/api.log .logs/dev/gallery.log`).
- DevTools MCP: `./scripts/mcp-devtools-server.sh` + `./scripts/mcp-chrome.sh`, open `/personal-site-kit`, verify console + network clean.
- MCP logs: `.logs/dev/mcp-devtools.log` (set `MCP_DEVTOOLS_LOG_FILE` to override).
- Playwright: `pnpm --filter gallery e2e tests/bitcoin-network-status.spec.ts` (or full suite with `pnpm --filter gallery e2e`).
- Fallback if MCP unavailable: `pnpm qa:regtest-demo`.

### qa:regtest-demo preflight controls

The QA script performs a preflight check to ensure the gallery is reachable.

- `GALLERY_URL`: Base URL to check (default: `https://localhost:4173`).
- `SKIP_PREFLIGHT=1`: Bypass the reachability check.
- `PREFLIGHT_RETRIES`: Number of attempts (default: 3).
- `PREFLIGHT_DELAY_MS`: Delay between retries (default: 2000).
- `PREFLIGHT_TIMEOUT_MS`: Timeout for each fetch attempt (default: 5000).

## Dev logs troubleshooting

- If `pnpm dev:logs` fails with port conflicts (3001/4173), rerun with `FORCE_KILL_PORTS=1 pnpm dev:logs`.
- `FORCE_KILL_PORTS=1` will terminate any existing process bound to those ports.

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

## Manual Verification Flows

To verify manually during development:

1. **Start Dev Server**:

   ```bash
   pnpm dev
   ```

   This starts the API (port 3001) and Gallery (port 4173).

2. **Login**:

   - Open `http://localhost:4173`.
   - Select "MANUAL_OVERRIDE (NSEC)".
   - Enter a valid nsec (e.g. `nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5`).
   - Click "EXECUTE".

3. **Feed & Posting**:

   - Confirm "STREAMING_LIVE_EVENTS..." appears.
   - Type in the "WHAT ARE YOU HACKING ON?..." box.
   - Click "PUBLISH_EVENT".
   - Confirm status updates to "Signing event..." -> "Event published".

4. **Telemetry**:

   - Open the browser console or check the "SYSTEM_TELEMETRY" sidebar (if enabled).
   - Verify connection messages to relays (`wss://relay.damus.io`).

5. **Lightning (Zaps)**:

   - On a feed item, click "⚡ ZAP".
   - Confirm the Zap modal appears with a QR code.
   - (Optional) Pay the invoice if you have a wallet connected to the same network context, or just verify the UI flow.

6. **Paywall**:
   - Verify that some content might be blurred (if `paywall` tag is present on events, mostly relevant for testing with specific seeded data).
