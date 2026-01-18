# Issue: Link Preview Proxy Rate Limits Cause Console Errors

## Summary

During local QA runs, the app logs repeated console errors for HTTP 429 responses when link previews attempt to fetch Open Graph metadata via `api.microlink.io`. These errors can cause QA failures and indicate rate limiting from the third-party proxy.

## Evidence

- `pnpm qa:regtest-demo` logged multiple "Failed to load resource: the server responded with a status of 429" console errors.
- The LinkPreview component calls `https://api.microlink.io/?url=...` for each URL preview.
- External rate limits appear to be triggered during automated runs.

## Impact

- Local QA is flaky and fails when the proxy rate-limits requests.
- Users may see missing previews or console errors when the proxy is unavailable or limited.

## Proposed Fix

- Add caching, throttling, or batching for link preview fetches.
- Add a lightweight backend proxy with rate limiting and caching.
- Add a dev/test override to avoid remote OG fetches (already mitigated locally, but production still uses the proxy).

## Notes

- Consider migrating to a self-hosted OG proxy to avoid third-party limits.
