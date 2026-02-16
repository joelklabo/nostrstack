# Scripts Layout

This repository groups automation scripts by functional area to make commands easier to discover.

## Canonical layout

- `scripts/dev/` — local development helpers
  - `logs.sh` (replace: `dev:logs`)
  - `network-switch.sh` (replace: `dev:network`)
  - `watch-api.sh`, `watch-site.sh`, `watch-social.sh` (replace: `dev:*:entr`)
  - `launch-local-demo.sh`
  - `launch-honkbox.sh`
- `scripts/demo/` — demo mode orchestration
  - `run.sh` (master entrypoint; accepts `regtest|mutinynet|mainnet`)
  - `regtest.sh`, `mutinynet.sh`, `mainnet.sh`
- `scripts/regtest/`
  - `bootstrap-lnbits.sh`, `status.sh`
- `scripts/lnbits/`
  - `smoke.sh`, `status.sh`, `cutover-mainnet.sh`, `setup-voltage.sh`
- `scripts/mcp/`
  - `chrome.sh`, `devtools-server.sh`

## Backward compatible aliases

Top-level scripts in `scripts/*.sh` remain as compatibility wrappers and forward to the canonical location.

## Usage

- `pnpm dev:logs` -> `scripts/dev/logs.sh`
- `pnpm dev:ps` -> `scripts/dev/dev-ps.sh`
- `pnpm dev:stop` -> `scripts/dev/dev-stop.sh`
- `pnpm dev:stop:all` -> `scripts/dev/dev-stop.sh --all`
- `pnpm dev:network` -> `scripts/dev/network-switch.sh`
- `pnpm demo:regtest` -> `scripts/demo/run.sh regtest`
- `pnpm dev:api:entr` -> `scripts/dev/watch-api.sh`
- `pnpm dev:social:entr` -> `scripts/dev/watch-social.sh`

### Session-aware environment variables

- `NOSTRDEV_AGENT` (default: `$USER`) identifies the owner for session metadata and stopping by agent.
- `NOSTRDEV_AGENT_SLOT` selects a specific session slot (`0` maps to `3001/4173`).
- `NOSTRDEV_MANAGED_SESSION=0` uses explicit `PORT` and `DEV_SERVER_PORT` without auto-allocating.
- `NOSTRDEV_BASE_API_PORT`, `NOSTRDEV_BASE_SOCIAL_PORT` set the auto-allocation base values.
- `NOSTRDEV_MAX_SLOTS` sets the session search range (default `40`).
