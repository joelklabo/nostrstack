# Find Friend + Tip Flow

This guide describes the “Find friend” flow in the gallery app, from searching for a friend to zapping posts and sending a 500-sat tip.

## Overview
1. Open **Find friend** from the sidebar (or `/search`).
2. Enter an identifier (npub/nprofile/hex/nip05).
3. Open the resolved profile.
4. Zap two posts and send a 500-sat tip via **Send sats**.

## Search inputs
Supported identifiers:
- **npub** (`npub1...`)
- **nprofile** (`nprofile1...`)
- **hex pubkey** (64-char hex string)
- **NIP-05** (`name@domain`)

Behavior:
- **npub/nprofile/hex** resolve locally in the browser.
- **NIP-05** resolves via the API proxy (`/api/nostr/identity`) and is cached.
- Lightning addresses without an attached Nostr profile display a “Lightning address detected” callout.

Limitations:
- This is **not** a global people search.
- **Login is required** to sign zap requests and tips.

## Tip + zap flow
On a profile with a lightning address (`lud16` or `lud06`):
- The **Tip** panel is shown with quick amounts and **Send sats**.
- Posts on the profile include **Zap** buttons.
- Payment modals show invoice status and include the NIP-57 receipt disclaimer.

## Configuration

### API (NIP-05 proxy)
Set in `.env` (API server):

```sh
NIP05_PROXY_TIMEOUT_MS=3000
NIP05_PROXY_CACHE_TTL_SECONDS=600
NIP05_PROXY_NEGATIVE_TTL_SECONDS=120
NIP05_PROXY_MAX_RESPONSE_BYTES=65536
NIP05_PROXY_ALLOW_HTTP_LOCALHOST=true
```

- **Timeout**: aborts slow lookups.
- **Cache TTL**: successful response cache.
- **Negative TTL**: cached “not found” responses.
- **Max response bytes**: prevents large nostr.json payloads.
- **Allow HTTP localhost**: enables local dev without HTTPS.

### Gallery (search + tips)
Set in `apps/gallery/.env` or root `.env`:

```sh
VITE_API_BASE_URL=http://localhost:3001
VITE_ENABLE_PROFILE_PAY=true
VITE_SEND_SATS_DEFAULT=500
VITE_SEND_SATS_PRESETS=21,100,500
VITE_NOSTRSTACK_RELAYS=wss://relay.damus.io
```

Notes:
- `VITE_ENABLE_PROFILE_PAY=true` is required to show **Send sats** on profiles.
- `VITE_API_BASE_URL` must point to the API server for NIP-05 resolution.

## Troubleshooting
- **Search fails or times out**: verify `VITE_API_BASE_URL`, and that the API server can reach `/.well-known/nostr.json`.
- **NIP-05 not found**: ensure the domain publishes the correct `nostr.json` with a matching `names` entry.
- **“Lightning address detected”**: no pubkey mapping exists for the lightning address; ask for a Nostr pubkey or a valid NIP-05.
- **No Send sats**: enable `VITE_ENABLE_PROFILE_PAY=true` and ensure the profile has `lud16` or `lud06`.
- **Zap/LNURL errors**: verify LNURL metadata endpoints and invoice callback URLs; in dev, HTTP is allowed only for localhost.
