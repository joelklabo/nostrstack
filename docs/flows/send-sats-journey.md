# Send sats + zap journey (logged-in user)

## Goal
A logged-in user can:
1) browse the feed,
2) zap two posts,
3) navigate to a friend's profile,
4) send 500 sats to the friend,
5) return/back without losing context.

This doc describes UI steps, backend calls, and state transitions for both zap and profile payments.

## Preconditions
- User is authenticated (nsec or NIP-07) and has a pubkey.
- Feed can render posts with author pubkeys.
- Friend has profile metadata (kind 0) and optional lightning address (lud16/lud06).
- Lightning flow supports LNURL-pay and NWC/WebLN/QR fallback.

## Key data sources
- Nostr relays (profile metadata, feed posts).
- LNURL payRequest endpoint for the lightning address (lud16/lud06).
- NWC relay (if user connects a wallet).

## Happy path (end-to-end)
1. Login
   - User signs in (NIP-07 or manual nsec).
   - UI shows Feed view.

2. Feed browse
   - Posts render with author identifier.
   - User identifies two posts to zap.

3. Zap post #1
   - Click "Zap" on a post.
   - System resolves lightning address (author metadata, event tags, config fallback).
   - Fetch LNURL metadata; validate min/max, callback, metadata.
   - Create NIP-57 zap request (kind 9734) with p-tag and e-tag.
   - Request invoice from callback; show invoice QR or NWC/WebLN pays.
   - If paid, show "Paid" state and close.

4. Zap post #2
   - Repeat zap flow for another post.

5. Navigate to friend profile
   - Click author name or avatar.
   - Route to /p/<npub|hex> without full page reload.
   - Profile view loads metadata + recent notes.

6. Send 500 sats
   - Profile shows "Send sats" card if lightning address exists.
   - Default amount = 500 sats, user can adjust if needed.
   - Fetch LNURL metadata and validate limits.
   - Create NIP-57 zap request with p-tag only (no e-tag).
   - Request invoice; pay via NWC/WebLN or show QR.
   - Success state confirmed; user can close and return/back.

7. Return/back
   - Browser back returns to feed with previous scroll position (best-effort).

## State transitions

### Zap flow states
- idle
- pending_lnurl
- pending_invoice
- waiting_payment
- paid
- error

Transitions:
- idle -> pending_lnurl (click zap)
- pending_lnurl -> pending_invoice (metadata valid)
- pending_lnurl -> error (no LN address or invalid metadata)
- pending_invoice -> waiting_payment (invoice ready)
- waiting_payment -> paid (NWC/WebLN success or status poll paid)
- waiting_payment -> error (payment error)
- paid -> idle (close)
- error -> idle (close)

### Send sats flow states (profile tip)
- idle
- pending_lnurl
- pending_invoice
- waiting_payment
- paid
- error

Transitions mirror zap flow but zap request only includes p-tag (no e-tag).

## Error handling and edge cases
- No lightning address on profile: show "Lightning address not available" and disable send.
- LNURL metadata invalid:
  - Missing callback, metadata, or min/max -> show error.
  - min > max -> show error.
- Amount out of bounds:
  - Disable CTA; show min/max range.
- commentAllowed = 0:
  - Hide or disable comment input.
- Invoice not returned:
  - Show error and allow retry.
- NWC/WebLN unavailable:
  - Fall back to QR/manual invoice copy.
- User not logged in:
  - Block zap/send; show "Login required" and link to login flow.
- No posts in feed:
  - Skip zap steps and surface empty state.

## Open questions
- Should we persist last profile route for faster "back" to feed?
- Should we cache LNURL metadata per lightning address for session?
- Should send sats allow custom messages, and how to enforce commentAllowed?

## Assumptions
- Profile payments use LNURL-pay and optionally NIP-57 zap request with p-tag only.
- UI uses existing modal patterns and does not migrate to a full router.
- Payment confirmation relies on NWC/WebLN success or status polling; no on-chain verification.
