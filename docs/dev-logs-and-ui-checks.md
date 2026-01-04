# Dev workflow: logs + UI verification

## Always run with logs visible
- Use `make dev` (or `pnpm dev:logs`, wrapper for `scripts/dev-logs.sh`) when developing. It starts API + gallery with prefixed, timestamped output and writes to `.logs/dev/api.log` and `.logs/dev/gallery.log`.
- `make dev` also brings up the regtest stack (bitcoind + lnd-merchant + lnd-payer + LNbits) and auto-exports the LNbits admin key and first wallet id (`LN_BITS_API_KEY`, `VITE_LNBITS_ADMIN_KEY`, `VITE_LNBITS_WALLET_ID`) so the wallet panel works out of the box.
- Keep a terminal pane tailing logs: `tail -f .logs/dev/api.log .logs/dev/gallery.log`.
- Include log snippets in issue notes when you hit errors.
- Telemetry websocket: the gallery connects via the current page origin (`wss://<host>/ws/telemetry` in dev). Run `make dev` so the Vite proxy forwards to the API.

## UI changes must be confirmed in MCP Chrome
- Launch Chrome DevTools MCP bridge: `./scripts/mcp-devtools-server.sh` (server) and `./scripts/mcp-chrome.sh` (client) while the gallery is running.
- The MCP server waits for remote debugging to come up and logs to `.logs/dev/mcp-devtools.log`.
- After UI changes, open the modified view in Chrome via MCP and capture a screenshot / verify console is clean.
- If errors appear in console/network panels, record them in the issue before closing.

## Checklist before marking issues done
1) `pnpm dev:logs` running (or equivalent log tail) while reproducing/fixing.
2) Inspect API + gallery logs for errors and note any findings in the issue.
3) For UI work: confirm in MCP Chrome DevTools, capture evidence if regressions are fixed, and ensure console is clean.
