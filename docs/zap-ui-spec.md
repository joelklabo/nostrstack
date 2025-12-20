# Zap Modal UI Spec (Tip-Inspired)

## Goals
- Present a premium zap experience inspired by the Lightning Tip demo UI.
- Avoid layout shift in the feed: modal must render in a fixed overlay.
- Make payment actions obvious (copy, open wallet, regtest pay) while keeping invoice visible.

## Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  ZAP ⚡ 21                                                    │  Header
│  @npub...                                                     │  Sub
├─────────────────────────────────────────────────────────────┤
│  [ QR PANEL ]        [ STATUS + ACTIONS ]                    │
│  ┌───────────┐       Status: Invoice ready                   │
│  │   QR      │       Buttons: Copy, Open Wallet, Pay Regtest │
│  └───────────┘       Invoice box (scrollable, monospace)     │
└─────────────────────────────────────────────────────────────┘
```

- **Left column**: QR container with branded frame.
- **Right column**: Status text + action buttons + invoice box.
- **Invoice box**: fixed height, scrollable, word-wrap.

## Layout (Mobile)
- Single-column stack:
  1. Header
  2. Status
  3. QR
  4. Actions
  5. Invoice
- Ensure QR stays at least 240px wide.

## Visual Styling
- Surface: same card style as tip popover (border, subtle shadow).
- QR frame: use tip/InvoicePopover style (rounded, border, subtle shadow).
- Buttons: reuse `nostrstack-btn` styles (primary for Open Wallet, neutral for Copy, warning for Regtest Pay).
- Status: monospace or small caps for terminal feel, but clean spacing.

## Motion
- Overlay fade-in: 150–250ms ease-out.
- Modal pop-in: subtle scale (0.98 -> 1.0).
- Respect `prefers-reduced-motion` (disable scale animations).

## Overlay Behavior
- `position: fixed; inset: 0;` with translucent backdrop.
- Disable background scroll (add `overflow: hidden` on body while open).
- Clicking backdrop closes modal (optional), but must not close on modal click.

## Accessibility
- `role="dialog"`, `aria-modal="true"` on modal container.
- Focus trap within modal while open.
- ESC closes modal and returns focus to Zap button.
- Status text uses `aria-live="polite"` to announce updates.
- Buttons show focus rings (`:focus-visible`).

## Content States
- **Resolving**: status line + spinner; no QR.
- **Invoice Ready**: QR + invoice box visible.
- **Paid**: success banner with checkmark + confetti optional.
- **Error**: red status line + retry/close action.

## Components/Classes
Suggested class names for styling:
- `.zap-overlay`
- `.zap-modal`
- `.zap-header`
- `.zap-subtitle`
- `.zap-grid`
- `.zap-qr`
- `.zap-status`
- `.zap-actions`
- `.zap-invoice-box`
- `.zap-close`

## Non-Goals
- Redesign the entire feed UI.
- Add non-zap payment flows.

