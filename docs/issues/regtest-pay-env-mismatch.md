# Issue: Regtest Pay Env Mismatch Breaks QA

## Summary

The regtest Pay button appears in the web UI during local dev, but QA fails because the API regtest pay route is disabled by default.

## Evidence

- `pnpm qa:regtest-demo` failed until `ENABLE_REGTEST_PAY=true` and `ENABLE_REGTEST_FUND=true` were exported when running `pnpm dev:logs`.
- `.env` defaults set:
  - `ENABLE_REGTEST_PAY=false`
  - `ENABLE_REGTEST_FUND=false`
- `scripts/dev/logs.sh` sets `VITE_ENABLE_REGTEST_PAY` and `VITE_ENABLE_REGTEST_FUND` to true on regtest, so the UI shows `PAY_REGTEST` even when the API is disabled.

## Impact

- Regtest pay flow is broken in local QA by default.
- `qa-regtest-demo` is flaky unless the developer manually exports the API regtest flags.

## Proposed Fix

- Option A: In `scripts/dev/logs.sh`, mirror the `VITE_ENABLE_*` defaults into `ENABLE_REGTEST_PAY` and `ENABLE_REGTEST_FUND` when `BITCOIN_NETWORK=regtest`.
- Option B: Update `.env` (or `.env.network.regtest`) defaults to enable regtest pay/fund for local QA.
- Option C: Update QA script to force env flags or surface a clear error when regtest pay is disabled.

## Notes

- This is configuration-only; no product behavior change required.
