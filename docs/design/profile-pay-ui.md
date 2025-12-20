# Profile payment UI + navigation spec

## Overview
Design a profile payment UI that lets a user send sats (default 500) to a profile and navigate to profiles from feed without a full router migration. Reuse existing zap modal styling for consistency.

## UI components

### 1) Profile header (existing)
- Avatar, display name, npub, nip05, about.
- Keep Lightning address card visible when available.

### 2) Send sats card (new)
Place under the Lightning address card in ProfileView.

Wireframe (desktop):
- Card header: "SEND_SATS"
- Subtext: "Support this creator" (optional, smaller).
- Amount row:
  - Label: "AMOUNT_SATS"
  - Input (number) with min/max hints (from LNURL metadata).
  - Preset chips (e.g., 21, 100, 500) inline or wrapped.
- Message row (optional if commentAllowed > 0):
  - Label: "NOTE" (max N chars), helper text shows remaining.
- Primary action:
  - Button label: "SEND 500" (dynamic to amount).
- Status row:
  - Inline status text: "Resolving LNURL…", "Invoice ready", "Paid".
- Invoice panel (modal or inline, see below).

Wireframe (mobile):
- Stack all rows; preset chips wrap to new line.
- Amount input spans full width.
- Primary button full width.

### 3) Send sats modal (new, reuse zap modal)
Open as modal to show invoice + QR. Reuse zap modal layout and styles:
- Title: "SEND {amount}"
- Subtitle: short npub or display name.
- Status area with spinner.
- QR panel + invoice code box.
- Actions: COPY_INVOICE, OPEN_WALLET, PAY_REGTEST (if enabled), CLOSE.

### 4) Author navigation in feed
Make author name clickable and route to /p/<npub|hex>.

- Click target: author label in post header.
- Optional: add small "View profile" tooltip.
- Use pushState + popstate to avoid full reload.
- If invalid pubkey, show toast or inline error and stay in feed.

## Interaction details

### Send sats card flow
1. User selects preset or types amount.
2. Click "SEND {amount}".
3. Card shows loading status; modal opens.
4. Modal resolves LNURL metadata + invoice.
5. If NWC connected, attempt auto-pay, then confirm.
6. If WebLN available, attempt WebLN pay; else show QR.
7. On paid: show success state and close button.

### Author navigation flow
- Click author -> navigate to /p/<id>.
- Back button returns to feed; preserve scroll best-effort.

## Accessibility
- Modal uses focus trap, ESC closes, role="dialog", aria-labelledby + aria-describedby.
- Primary CTA is first focusable in card; modal close is last.
- All buttons have aria-labels if icon-only.
- Status updates use aria-live="polite".

## Copy guidelines (exact text)
- Card title: "SEND_SATS"
- Amount label: "AMOUNT_SATS"
- Button: "SEND {amount}"
- Status: "Resolving LNURL…", "Requesting invoice…", "Invoice ready", "Payment confirmed".
- Error: "Lightning address not available", "Invoice failed. Try again."

## Visual tokens / styles
- Reuse existing classes: .action-btn, .zap-overlay, .zap-modal.
- New classes:
  - .send-sats-card
  - .send-sats-amount
  - .send-sats-presets
  - .send-sats-status
  - .send-sats-note
- Colors: reuse var(--color-*) tokens and zap modal colors.
- Spacing: match lightning card (padding 1rem, radius 12px).

## Edge cases
- Small screens: wrap preset chips, avoid overflow on lightning address.
- Missing profile metadata: show placeholder + disable send.
- Invalid pubkey in route: display error and redirect to feed or current profile.

## Open questions
- Should SendSats be inline (expandable) or always modal?
- Should we show last payment status in Settings (NWC) or on profile card?
