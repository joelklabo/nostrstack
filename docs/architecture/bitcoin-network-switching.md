# Bitcoin network switching plan

## Goals
- Switch cleanly between regtest, mutinynet, and mainnet for the bitcoin node and lightning backend.
- Provide a developer-friendly, repeatable way to select the active network and its presets.
- Surface network and node state in the UI with clear mainnet warnings.

## Current hooks
- Demo scripts exist for regtest/mutinynet/mainnet in `scripts/demo-*.sh`.
- Telemetry uses bitcoind RPC and includes chain info from `getblockchaininfo`.
- Regtest pay/fund are gated by `ENABLE_REGTEST_*` (API) and `VITE_ENABLE_REGTEST_*` (gallery).

## Plan

### 1) Network config and presets
- Add `BITCOIN_NETWORK` to `apps/api` env (regtest | mutinynet | mainnet). Default to `regtest` in dev.
- Add `VITE_NETWORK` (same enum) to gallery env and expose via config context for UI.
- Add `TELEMETRY_PROVIDER` (bitcoind | mempool | mock) and `BITCOIND_RPC_URL` overrides.
- Create profile files:
  - `.env.network.regtest`
  - `.env.network.mutinynet`
  - `.env.network.mainnet`
- Add a single dev entrypoint (example):
  - `pnpm dev:network -- --network regtest|mutinynet|mainnet`
  - Loads the profile, starts the regtest stack when needed, and starts API + gallery.
- Keep the mainnet safety gate (`MAINNET_DEMO_OK=true`).
- Align regtest flags with `BITCOIN_NETWORK=regtest` so they do not drift.

### 2) API: network status and telemetry normalization
- Add `/api/bitcoin/status` (or `/api/network/status`) that returns:
  - network id and source (bitcoind vs provider vs config)
  - tip height, last block time, block interval
  - mempool size/bytes
  - sync state (initialblockdownload, verification progress, headers/blocks)
  - lightning provider health (LNbits health + optional wallet balance)
- Extend telemetry summary/ws payloads with sync fields and a `source` tag.
- For mutinynet/mainnet without bitcoind, use a provider adapter (mempool or blockstream) instead of returning `mocknet`.
- Add tests for provider selection and status payload shape.

### 3) UI: surface network and state
- Fetch `/api/bitcoin/status` on load and merge with telemetry WS updates.
- Expand `BitcoinNodeCard` to show:
  - network badge and data source
  - sync progress and block age
  - mempool txs/size and peers
- Add a network banner in the sidebar or top bar:
  - regtest/mutinynet/mainnet label
  - mainnet warning when active
  - lightning provider health indicator
- Use design tokens and `.nostrstack-*` primitives, avoid hard-coded colors.

### 4) Dev workflow and QA
- Update demo scripts to use the new network profiles.
- Add smoke checks per network (API status + telemetry + payment flow where applicable).
- Update `docs/local-demo.md` and `docs/testing.md` with the new switch flow.

## Acceptance targets
- One command switches the full stack between regtest, mutinynet, and mainnet.
- API exposes a single network status payload used by the UI.
- UI clearly indicates the active network and node health.
- Mainnet usage is visibly gated and warned.
