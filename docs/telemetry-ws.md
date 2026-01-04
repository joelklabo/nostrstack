# Telemetry WebSocket Reliability (Design)

## Goal
Provide a resilient WebSocket connection to `/ws/telemetry` with predictable backoff, jitter, and clear UI status/fallback behavior.

## Connection states
- **connecting**: initial socket open attempt.
- **connected**: socket open and receiving messages.
- **reconnecting**: after unexpected close/error; backoff in progress.
- **offline**: exceeded retry cap or browser offline; fallback to HTTP summary only.

## Backoff strategy
- Base delay: 1000ms
- Multiplier: 2x per attempt
- Jitter: random +/- 20% (full jitter acceptable)
- Max delay: 30000ms
- Max attempts: 8 before switching to **offline**
- Attempt count starts at 0 for the first reconnect attempt.

Pseudo:
```
nextDelay = min(maxDelay, base * 2^attempt)
withJitter = nextDelay * (1 - 0.2 + rand() * 0.4)
```

## Retry rules
- Do not retry on policy/auth failures (HTTP 401/403 in handshake, or close codes 4001/4003).
- If `navigator.onLine === false`, pause reconnect attempts until the browser fires `online`.
- For clean closes initiated by the client, do not schedule a reconnect.

## Fallback behavior
- On first disconnect/error, fetch `/api/telemetry/summary` and show cached data.
- While **offline**, continue polling summary every 30s (jittered) without spamming logs.
- On successful WS reconnect, stop HTTP polling and clear offline banner.
- If summary polling fails 3 consecutive times, back off to 60s and show "stale" badge.

## UI requirements
- Status badge shows: Connected / Reconnecting (attempt X) / Offline.
- Show last update timestamp from either WS or HTTP.
- If browser is offline (`navigator.onLine === false`), show Offline immediately.

## Status dwell timing
- The UI waits `statusDwellMs` (default: 400ms) before showing **reconnecting**/**offline** to avoid flicker during brief disconnects.
- Set `statusDwellMs` to `0` (or any value <= 0) to disable the dwell and show status changes immediately.
- In dev builds only, override via:
  - `window.__NOSTRSTACK_TELEMETRY_TIMING__ = { statusDwellMs: 0 }`

## Logging + metrics (client-side)
- Log state transitions at `info`, errors at `warn`.
- Avoid repeated identical logs; debounce identical error messages.
