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
│ Replies                                                        │
│  - Reply summary + count                                       │
│  - Reply list (chronological)                                  │
│  - Load more / pagination controls                             │
│  - Empty/error states                                          │
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
  - Replies section stacks with a full-width "Load more" button.
  - Reference previews become a vertical list with simplified cards.
  - Tags wrap into a scrollable chip list; long tags truncate.
  - Raw JSON collapsed by default to reduce scroll length.

- **≤ 480px**:
  - Reduce title size; keep subtitle muted.
  - Copy buttons move below values or become icon-only.
  - Reply cards collapse to author + snippet + time.
  - Reference preview cards show only: kind, author, short snippet.
  - Reply indentation caps at depth 2 with a compact depth badge (e.g., “↳ 3”).

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

### Replies States
- **Loading**: Show skeleton or spinner for reply list; keep count placeholder.
- **Empty**: Show “No replies yet” with guidance to check relays.
- **Error**: Show error banner in replies section with retry affordance.
- **Partial**: Render replies that load; show muted banner for missing pages.
- **Orphaned**: Render reply with “Parent unavailable” subtitle and optional jump-to-id link.

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
- **No replies**: show empty state instead of hiding the section.
- **Large threads**: paginate replies; avoid rendering unbounded lists.
- **Deep nesting**: cap indentation at 3 levels; flatten deeper replies with a depth badge.
- **Mixed reply kinds**: render non-text replies (reactions/zaps) as compact chips or skip with a note.

## Standing Note
While working on this UI, **always** look for refactoring opportunities, bugs, or improvements and create new bd tasks as they surface.
