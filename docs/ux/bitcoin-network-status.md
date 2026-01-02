# Bitcoin network status: UX spec

## Goals
- Make the active Bitcoin network and data source obvious at a glance.
- Surface sync health and Lightning health without overwhelming the sidebar.
- Warn loudly on mainnet to avoid accidental real payments.
- Degrade gracefully when status data is unavailable.

## Surfaces
- Sidebar summary: compact badge + short status.
- Network details card (Telemetry/BitcoinNodeCard): full status fields.
- Settings (dev only): network selector for local testing.

## Data contract (from /api/bitcoin/status)
- configuredNetwork: configured chain (regtest | mutinynet | mainnet).
- network: telemetry-reported chain (may differ).
- source: telemetry provider (bitcoind | esplora | mock).
- telemetry: height, headers, blocks, verificationProgress, initialBlockDownload, mempoolTxs.
- telemetryError: error string if provider fallback or failure occurred.
- lightning.provider: lnbits | (other).
- lightning.lnbits.status: ok | fail | error | skipped.

## UI states + copy

### Global states
- Loading: "Loading network status…"
- Unavailable: "Bitcoin status unavailable. Retry." (non-blocking callout)

### Network badge
- Label: "Regtest", "Mutinynet", or "Mainnet".
- When telemetry network mismatches configuration, show callout:
  - Title: "Network mismatch"
  - Body: "Telemetry reports {telemetryNetwork}. Configured for {configuredNetwork}. Check TELEMETRY_PROVIDER and TELEMETRY_ESPLORA_URL."

### Mainnet warning
- Show when configuredNetwork === "mainnet".
- Banner copy:
  - Title: "Mainnet mode"
  - Body: "Real bitcoin and Lightning payments are enabled. Verify wallet and limits before sending."

### Source badge
- Bitcoind: "Source: Bitcoind"
- Esplora: "Source: Esplora"
- Mock: "Source: Mock data" + secondary text "Fix telemetry provider to see live data."

### Sync status
- If initialBlockDownload === true or verificationProgress < 0.99:
  - Status: "Syncing" with progress (e.g., "Syncing 72%")
- Else:
  - Status: "Synced" and show height + block time (if available)

### Lightning health
- ok: "LNbits healthy"
- fail: "LNbits unreachable"
- error: "LNbits misconfigured" (e.g., missing URL)
- skipped: "LNbits health skipped" (provider not lnbits)

### Telemetry error (non-fatal)
- If telemetryError is present:
  - Callout title: "Telemetry degraded"
  - Body: "{telemetryError}"

## Refresh behavior
- Status fetch can be polled (10s cadence) and updated in place.
- Manual refresh: optional (icon button) if added later.

## Screenshot plan (for docs/tests)
- Regtest: status card + sidebar badge.
- Mutinynet: status card showing Esplora source.
- Mainnet: banner warning visible.
