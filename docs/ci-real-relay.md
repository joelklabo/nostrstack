# Opt-in CI for real relay comments

Goal: run `apps/web/tests/comment-relay.spec.ts` against a real Nostr relay with a pre-authenticated NIP-07 signer.

## Secrets required
- `REAL_RELAY`: WebSocket URL, e.g. `wss://relay.damus.io`
- `NIP07_PROFILE_B64`: Base64-encoded zip of a Chrome user-data-dir that already has a NIP-07 signer extension installed and logged in (e.g., Alby or nos2x).

How to prepare `NIP07_PROFILE_B64`:
1. Start Chrome, create a fresh profile.
2. Install the signer extension and log in.
3. Quit Chrome completely.
4. Zip the profile directory (on macOS: `~/Library/Application Support/Google/Chrome/Profile 2`, on Linux: `~/.config/google-chrome/Profile 2`).
5. Base64-encode the zip: `base64 profile.zip | pbcopy` (or `| clip`).
6. Store the value in GitHub Actions secret `NIP07_PROFILE_B64`.

## How it runs
- Workflow job `real-relay-comment` is conditional on both secrets being present.
- The job restores the profile to `/tmp/nip07-profile` and passes it to Playwright via `CHROMIUM_USER_DATA_DIR`.
- The test uses the provided relay and posts a real comment, asserting relay mode is real.

## Local dry-run
```sh
CHROMIUM_USER_DATA_DIR=/path/to/profile \
REAL_RELAY=wss://relay.damus.io \
VITE_NOSTRSTACK_RELAYS=$REAL_RELAY \
pnpm --filter web exec playwright test tests/comment-relay.spec.ts --project=chromium
```

If secrets are missing, the CI job is skipped and all other jobs still run.
