# Nostr Event Landing UI: Wireframe + States

## Purpose
Define the layout hierarchy, responsive behavior, UI states, and accessibility guidance for the `/nostr/:id` landing page.

## Layout Hierarchy (Desktop)
```
┌─────────────────────────────────────────────────────────────────┐
│ Header                                                         │
│  - Title (Event kind label)                                    │
│  - Subtitle (Rendered by NostrStack)                           │
│  - Back to App action                                          │
├─────────────────────────────────────────────────────────────────┤
│ Metadata Card                                                  │
│  - Target (with Copy)                                          │
│  - Relay count                                                 │
│  - Status (loading/ready/error)                                │
├─────────────────────────────────────────────────────────────────┤
│ Event Details                                                  │
│  - Event ID (with Copy)                                        │
│  - Author pubkey (with Copy)                                   │
│  - Created timestamp                                           │
│  - Kind                                                        │
├─────────────────────────────────────────────────────────────────┤
│ Event Content                                                  │
│  - Author profile card (if available)                          │
│  - Rendered content (kind-aware)                               │
│  - Reference chips/links (inline or footer)                    │
├─────────────────────────────────────────────────────────────────┤
│ Reference Previews                                             │
│  - Root / Reply / Mention / Quote / Addressable sections       │
│  - Preview cards (limited list)                                │
├─────────────────────────────────────────────────────────────────┤
│ Tags                                                          │
│  - Tag chips (scrollable wrap)                                 │
├─────────────────────────────────────────────────────────────────┤
│ Raw JSON                                                       │
│  - Collapsible JSON viewer                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Responsive Behavior
- **≤ 768px**:
  - Header stacks vertically; Back to App becomes full-width button.
  - Metadata card becomes a single column with labels above values.
  - Event details stack in a single column.
  - Reference previews become a vertical list with simplified cards.
  - Tags wrap into a scrollable chip list; long tags truncate.
  - Raw JSON collapsed by default to reduce scroll length.

- **≤ 480px**:
  - Reduce title size; keep subtitle muted.
  - Copy buttons move below values or become icon-only.
  - Reference preview cards show only: kind, author, short snippet.

## UI States
- **Loading**
  - Show “Fetching event data…” text.
  - Keep metadata visible with status `LOADING`.
  - Skeleton blocks for event details/content.

- **Error**
  - Show a prominent error banner with reason.
  - Provide a retry affordance (refresh or re-fetch button).
  - Keep target/relay metadata visible for troubleshooting.

- **Empty / Not Found**
  - Similar to error but with softer tone (“Event not found”).
  - Suggest checking the event id and relay configuration.

- **Partial Data**
  - Event renders even if references or author profile missing.
  - Show placeholders for missing previews (e.g., “Reference unavailable”).

## Reference Previews Guidance
- Group by type: Root, Reply, Mention, Quote, Addressable, Profiles.
- Cap previews (default 4–6 per group) with “View more” link if overflow.
- Each preview card should show:
  - Kind label + created time
  - Author (npub short form)
  - 1–2 line content summary
  - Optional profile avatar (if available)

## Accessibility Notes
- Ensure **keyboard focus** on:
  - Copy buttons, reference chips, and preview cards.
  - Back to App link/button.
- Maintain **contrast** for text on all card backgrounds.
- Use **aria-labels** for copy buttons and icon-only actions.
- External links (e.g., media URLs) must include `rel="noreferrer"`.
- Preserve readable line lengths for long content (max ~70–80 chars per line).

## Edge Case Handling
- **Very long IDs/content**: truncate with ellipsis and show full value on copy.
- **No tags**: show “No tags” placeholder.
- **Missing author profile**: render event without profile card.
- **Excess references**: cap list and show overflow indicator.

## Standing Note
While working on this UI, **always** look for refactoring opportunities, bugs, or improvements and create new bd tasks as they surface.
