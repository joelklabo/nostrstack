# Find friend + tip journey (first-time user)

## Goal
A new user can:
1) sign in,
2) find a friend by identifier,
3) open the friend profile,
4) zap two posts,
5) send a 500-sat tip,
6) see a clear success confirmation.

This doc describes UI steps, system calls, and state transitions for the search + payment flow.

## Preconditions
- User can log in via NIP-07, nsec, or LNURL-auth.
- Search accepts identifiers: npub, nprofile, hex pubkey, nip05, lightning address.
- NIP-05 lookups are resolved via API proxy (HTTPS-only, no redirects).
- Lightning flow supports LNURL-pay and NWC/WebLN/QR fallback.

## Key data sources
- Nostr relays (profile metadata, posts).
- API NIP-05 proxy endpoint (identity lookup + caching).
- LNURL pay endpoints (lud16/lud06) for tips and zaps.

## Happy path (end-to-end)
1. Landing + login
   - User lands on app.
   - Chooses NIP-07, nsec, or LNURL-auth login.
   - On success, navigates to Feed (or Search).

2. Find friend entry
   - User clicks "Find friend" in sidebar or feed CTA.
   - Search view opens with a single input.

3. Resolve identifier
   - User pastes npub/nprofile/nip05/lightning address.
   - Client validates locally (bech32/hex) and uses NIP-05 proxy when needed.
   - On success, show a result card with avatar/name and verified badge (if nip05).

4. Open profile
   - User selects the result.
   - Route to /p/<npub> without full page reload.
   - Profile metadata + recent notes load.

5. Zap two posts
   - User clicks Zap on two posts.
   - App resolves lightning address (event/profile/config fallback).
   - LNURL metadata fetched, invoice created, modal shows "Invoice ready".
   - User closes after confirming invoice state.

6. Send 500 sats
   - Profile shows a Tip panel with preset 500.
   - User clicks "Tip 500".
   - LNURL metadata fetched, invoice created, modal shows "Invoice ready".
   - Payment confirmed (NWC/WebLN/status poll) -> success state.

7. Confirmation
   - UI shows explicit success message.
   - If only zap receipt (not payment), show disclaimer.

## Decision points & fallback paths
- No login: block zap/tip and direct to login.
- Invalid identifier: show inline error and examples.
- NIP-05 timeout: show retry state and cached result if available.
- No lightning address: show "Tipping unavailable" and hide action.
- WebLN/NWC not available: show QR + copy invoice.

## State transitions

### Search resolution
- idle
- validating
- resolving (remote lookup)
- resolved
- error

Transitions:
- idle -> validating (input change)
- validating -> resolving (nip05 or remote)
- validating -> resolved (npub/hex decode)
- resolving -> resolved (proxy success)
- validating/resolving -> error (invalid input or failed lookup)

### Payment (zap + send sats)
- idle
- pending_lnurl
- pending_invoice
- waiting_payment
- paid
- error

Transitions:
- idle -> pending_lnurl (click action)
- pending_lnurl -> pending_invoice (metadata valid)
- pending_invoice -> waiting_payment (invoice ready)
- waiting_payment -> paid (confirmed payment)
- any -> error (validation/network failures)

## Error handling & edge cases
- Identifier parsing fails: show "Invalid format" + examples (npub1..., name@domain).
- NIP-05 host unreachable: show retry; do not auto-loop.
- Lightning address missing: show callout; disable send CTA.
- Amount out of bounds: show min/max and disable send.
- Invoice missing: show error and allow retry.
- User closes modal early: set state to idle, log telemetry.

## Open questions
- Should Search be the first view after login for first-time users?
- Should we persist recent searches in localStorage?
- Should we auto-open profile when a single valid input resolves?

## Assumptions
- Search is identifier-based, not global Nostr search.
- NIP-05 proxy provides a normalized response.
- Payment confirmation relies on NWC/WebLN or status polling.
