# Zap Regtest Payment Flow

## Scope
This document describes the end-to-end zap flow for the gallery demo and how regtest payment is initiated and confirmed. It also enumerates error states and edge cases so the UI remains stable and actionable.

## Actors
- **User**: initiates the zap.
- **Gallery UI**: builds zap request + renders invoice/QR.
- **LNURL-pay Server**: returns pay metadata and invoice (LNURL callback).
- **Regtest Payer**: local LND node that pays invoices via `/api/regtest/pay`.
- **API**: issues LNURL invoices and publishes receipts.

## Happy Path (Regtest)
1. User clicks **Zap**.
2. UI resolves author Lightning address (lud16/lud06/profile metadata).
3. UI fetches LNURL-pay metadata from `/.well-known/lnurlp/<name>`.
4. UI builds and signs NIP-57 zap request event.
5. UI calls LNURL-pay callback to request a BOLT11 invoice.
6. UI renders a modal with QR + invoice + actions.
7. User selects **Pay with regtest**.
8. UI POSTs invoice to `/api/regtest/pay`.
9. API pays invoice via local LND payer and responds success.
10. UI transitions to **paid** state and shows success.
11. API publishes a zap receipt (async) when it observes payment.

## State Machine

```
[IDLE]
  │ click Zap
  ▼
[RESOLVING_ADDRESS]
  │ lightning address found
  ▼
[FETCH_LNURL_METADATA]
  │ LNURL metadata ok
  ▼
[REQUEST_INVOICE]
  │ invoice returned
  ▼
[WAITING_PAYMENT]
  │ user pays (regtest/WebLN/external wallet)
  ▼
[PAID]
  │ auto-timeout or close
  ▼
[IDLE]

Any state can transition to [ERROR] on failure.
```

## Regtest Payment Trigger
- UI **must only show** the regtest pay action when `VITE_ENABLE_REGTEST_PAY=true`.
- When clicked:
  - POST `{ invoice }` to `${VITE_API_BASE_URL}/api/regtest/pay`.
  - On 200 OK, transition to **paid**.
  - On non-200, stay in **waiting_payment** and surface error message.

## UI Requirements (Behavioral)
- Modal is **overlayed** (fixed position) to prevent layout shift.
- The invoice and QR must be visible even when WebLN is available.
- State labels are visible and concise.
- Auto-timeout clears modal after a configurable period (default 5 minutes).
- Close action returns focus to Zap button.

## Edge Cases + Error Handling

### Lightning Address Resolution
- **No lud16/lud06**: show `ERROR: Author does not have a Lightning Address/LNURL.`
- **Malformed address**: show `ERROR: Invalid Lightning Address/LNURL.`

### LNURL Metadata
- **HTTP error**: show `ERROR: Failed to fetch LNURL metadata.`
- **Missing callback**: show `ERROR: LNURL metadata missing callback.`
- **minSendable/maxSendable mismatch**: clamp or error with `ERROR: Amount outside allowed range.`
- **allowsNostr false**: warn and proceed as non-zap invoice (no nostr param).

### Invoice Request
- **Invoice response missing `pr`**: show `ERROR: Invoice missing.`
- **Callback error**: show `ERROR: Invoice request failed.`

### Regtest Pay
- **Endpoint disabled**: show `ERROR: Regtest pay disabled.`
- **Invalid invoice**: show `ERROR: Invalid invoice.`
- **Pay failure**: show `ERROR: Payment failed (reason).`

### Connectivity
- **API offline**: surface `ERROR: API unavailable.`
- **LNURL host offline**: surface `ERROR: LNURL host unavailable.`

## Data/Events
- Zap request (NIP-57) includes `p`, `e`, `amount`, `lnurl`, `relays` tags.
- Receipt should include `bolt11` and `description` tags plus the original `p`/`e` tags.

## Testing Notes
- Unit test should validate that regtest endpoint is guarded and returns 403/404 when disabled.
- E2E test should open zap modal, request invoice, pay via regtest, and assert success state.

