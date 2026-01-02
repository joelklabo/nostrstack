# Bitcoin telemetry provider contract

## Goal
Define a stable telemetry summary contract so the API and UI can swap between bitcoind RPC and external explorer providers without changing client code.

## Provider responsibilities
- Fetch the tip height + hash and the latest block details.
- Populate TelemetrySummary fields; leave unsupported fields undefined.
- Set `network` to the configured network when the provider cannot supply it.
- Respect cache/backoff guidance to avoid rate limits and noisy logs.
- Emit short, actionable errors for `telemetryError` when falling back.

## TelemetrySummary shape
The API uses this shape for `/api/telemetry/summary` and `/api/bitcoin/status` telemetry payloads:

```
type TelemetrySummary = {
  height: number;
  hash: string;
  time: number; // unix seconds
  txs?: number;
  size?: number;
  weight?: number;
  interval?: number;
  mempoolTxs?: number;
  mempoolBytes?: number;
  network?: string;
  version?: number;
  subversion?: string;
  connections?: number;
  headers?: number;
  blocks?: number;
  verificationProgress?: number;
  initialBlockDownload?: boolean;
};
```

Related `/api/bitcoin/status` fields:
- `source`: provider id (`bitcoind`, `esplora`, `mock`).
- `telemetryError`: short error string when using cached/fallback data.

## Field mapping
| TelemetrySummary field | bitcoind RPC | Esplora/mempool HTTP |
| --- | --- | --- |
| height | `getblockcount` | `GET /blocks/tip/height` |
| hash | `getblockhash(height)` | `GET /blocks/tip/hash` |
| time | `getblock(hash)` -> `time` | `GET /block/:hash` -> `timestamp` |
| txs | `getblock(hash)` -> `tx.length`/`nTx` | `GET /block/:hash` -> `tx_count` |
| size | `getblock(hash)` -> `size` | `GET /block/:hash` -> `size` |
| weight | `getblock(hash)` -> `weight` | `GET /block/:hash` -> `weight` |
| interval | computed from previous `time` | computed from previous `time` |
| mempoolTxs | `getmempoolinfo` -> `size` | `GET /mempool` -> `count` |
| mempoolBytes | `getmempoolinfo` -> `bytes` | `GET /mempool` -> `vsize` (virtual bytes) |
| network | `getblockchaininfo` -> `chain` | configured network (no endpoint) |
| version | `getnetworkinfo` -> `version` | n/a (leave undefined) |
| subversion | `getnetworkinfo` -> `subversion` | n/a (leave undefined) |
| connections | `getnetworkinfo` -> `connections` | n/a (leave undefined) |
| headers | `getblockchaininfo` -> `headers` | set to `height` |
| blocks | `getblockchaininfo` -> `blocks` | set to `height` |
| verificationProgress | `getblockchaininfo` -> `verificationprogress` | set to `1` |
| initialBlockDownload | `getblockchaininfo` -> `initialblockdownload` | set to `false` |

## Sync indicators for external providers
External providers do not expose sync state. For mutinynet/mainnet, treat the explorer as authoritative and report:
- `headers = height`, `blocks = height`
- `verificationProgress = 1`
- `initialBlockDownload = false`

If the provider indicates stale data or fails entirely, return the last cached summary (if present) and surface `telemetryError` so the UI can show a degraded state.

## Error handling and telemetryError semantics
- When a provider fails but cached data is available, return the cached summary and set `telemetryError` to a short message (example: `esplora timeout; serving cached data`).
- When a provider fails and no cache is available, return `502 bitcoin_status_unavailable` (do not invent telemetry values).
- Clear `telemetryError` on the next successful fetch.

## Caching and backoff
- Cache the last successful summary per provider; default TTL 10-15s.
- Reuse an in-flight promise to prevent bursty parallel fetches.
- On repeated failures, use exponential backoff (1s -> 2s -> 4s -> 8s, max 30s) and log once per backoff window.

## Timeouts and rate limits
- Bitcoind RPC timeout: 8s (current default).
- External HTTP timeout: 3-5s with one retry if tip hash changes between calls.
- Avoid more than 1-2 external requests per polling interval.

## Non-goals
- Hosting a public explorer instance.
- Estimating wallet balances from telemetry data.
