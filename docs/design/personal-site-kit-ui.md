# Personal Site Kit UI: widgets + layout

## Goals
- Provide a cohesive support section (tip + share + comments) with clear states.
- Add a Nostr profile section and a blockchain stats card that feel native to the theme.
- Keep layouts responsive, token-driven, and safe for embed hosts.

## Layout overview

### Desktop (>= 960px)
```
┌───────────────────────────────────────────────────────────────┐
│ Support                                                       │
│  ┌───────────────────────────────┬───────────────────────────┐
│  │ Comments (primary column)     │ Tip card                  │
│  │ .nostrstack-comments           │ .nostrstack-pay           │
│  │                               │ Share button              │
│  │                               │ Tip activity feed         │
│  └───────────────────────────────┴───────────────────────────┘
├───────────────────────────────────────────────────────────────┤
│ Nostr profile section                                         │
├───────────────────────────────────────────────────────────────┤
│ Blockchain stats card                                         │
└───────────────────────────────────────────────────────────────┘
```

### Mobile (<= 960px)
```
Support
- Tip card
- Share button
- Tip activity feed
- Comments (full width)
Nostr profile section
Blockchain stats card
```

## Support section (tip + share + comments)

### Structure
- Use `.nostrstack-comment-tip__grid` as the base grid.
- Right column becomes a vertical stack: tip card, share card/button, tip feed.
- Left column remains the comments list and composer.

Suggested classes:
- `.nostrstack-support-section` (wrapper)
- `.nostrstack-support-header` (title + status)
- `.nostrstack-support-grid` (grid wrapper, can alias `.nostrstack-comment-tip__grid`)
- `.nostrstack-support-sidebar` (right column stack)

### Comments
- Reuse `.nostrstack-comments` styles; keep composer visible above list.
- Pagination or "Load more" button uses `.nostrstack-btn`.

### Share button
- Primary action uses `.nostrstack-btn` + `--primary`.
- Secondary fallback state uses `.nostrstack-btn--ghost`.
- Provide a short helper line beneath ("Published to Nostr" / "Copied link").

### Tip activity feed (real time)
- List of latest tips, newest first.
- Each row includes amount, time, and optional note.
- New entries should animate in with `nostrstack-rise` (respect reduced motion).

## Nostr profile section
- Card layout with avatar, display name, nip05 badge, and optional bio.
- Primary action is "Open in Nostr" or copy npub.

Suggested classes:
- `.nostrstack-profile-card`
- `.nostrstack-profile-avatar`
- `.nostrstack-profile-meta`
- `.nostrstack-profile-badge`
- `.nostrstack-profile-actions`

## Blockchain stats card
- Compact card showing height, mempool, and latest block hash/age.
- Show a status pill: Live / Stale / Error.

Suggested classes:
- `.nostrstack-blockchain-stats`
- `.nostrstack-blockchain-stat`
- `.nostrstack-blockchain-value`
- `.nostrstack-blockchain-label`
- `.nostrstack-blockchain-status`

## Responsive behavior
- <= 960px: grid collapses to single column; sidebar items stack above comments.
- <= 640px: reduce card padding; buttons become full-width; feed items compress to two lines.

## UI states
- Loading: skeleton rows, status line set to "Loading".
- Empty: friendly empty state ("Be the first to tip" / "No comments yet").
- Error: callout banner using `.nostrstack-callout` and `.nostrstack-status--danger`.
- Stale (telemetry WS down): show last updated time and a retry link.

## Accessibility checklist
- All buttons are keyboard-focusable with visible focus rings.
- Status text uses `.nostrstack-status` and `aria-live="polite"` where updates are real time.
- Avatar images include `alt` text; fallback shows initials.
- Ensure contrast for text on card backgrounds.
- Provide `aria-label` for icon-only actions.

## Motion guidance
- Use token timings: `--nostrstack-motion-fast|base` for hover and state transitions.
- Animate new feed items with subtle rise/fade; disable under `prefers-reduced-motion`.

## Token usage notes
- Use `--nostrstack-color-surface` + `--nostrstack-color-border` for cards.
- Use `--nostrstack-color-success|warning|danger` for status color cues.
- Use `--nostrstack-space-*` for consistent spacing.
