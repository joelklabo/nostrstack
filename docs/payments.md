# Payments: Profile SendSats + Zaps

This document covers the payment UX in the gallery app: profile tips (“Send sats”) and post zaps.

## Overview
- **Profile payments**: Users can send sats directly from a profile at `/p/<npub|hex>`.
- **Zaps**: Users can zap posts from the feed or profile timeline.
- Both flows use **LNURL-pay** metadata, generate a **NIP-57 zap request**, and request an invoice.

## Profile SendSats
SendSats appears on a profile when the user has a lightning address configured:

- **LUD-16** (`lud16`): `user@domain` lightning address.
- **LUD-06** (`lud06`): LNURL bech32 string.

Flow:
1. Select a preset or enter a custom amount.
2. Click **SEND {amount}**.
3. LNURL metadata is resolved (min/max limits + commentAllowed).
4. Invoice requested and modal opens.
5. Payment attempts:
   - **NWC** (if configured) → automatic pay
   - **WebLN** (if available)
   - **QR/manual** (fallback)
6. Success action is displayed if provided by LNURL.

Notes:
- `commentAllowed=0` disables the note input.
- Missing lightning address shows a callout and disables SendSats.

## Zaps
Zap buttons on posts use the same LNURL-pay + NIP-57 flow and follow the same payment fallbacks (NWC → WebLN → QR/manual). Zap requests include `p` + `e` tags for the author and event.

## Configuration (Gallery)
Set in `apps/gallery/.env` or root `.env`:

```sh
VITE_ENABLE_PROFILE_PAY=true
VITE_SEND_SATS_DEFAULT=500
VITE_SEND_SATS_PRESETS=21,100,500
```

Optional (dev/regtest):

```sh
VITE_ENABLE_REGTEST_PAY=true
VITE_NOSTRSTACK_RELAYS=wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol
```

## NWC + WebLN
- **NWC**: Configure a NWC URI in the Settings view. It attempts auto-pay when invoices are ready.
- **WebLN**: If `window.webln` is available, it is used automatically before showing QR.

## Dev tips
- For a local demo, run `pnpm demo:regtest` (API on :3001, gallery on :4173).
- LNURL callbacks require **https** in production; **http** is allowed for localhost.
- If lightning address fields are missing, SendSats stays disabled until metadata includes `lud16` or `lud06`.
