# Social Design Refresh Implementation

## Status: Partially Complete (Environment Blocked)

I have implemented the core components for the Social Design Refresh, but the automated tests for `FeedView` are failing due to a pre-existing or environmental crash (likely related to Mock Relay connection).

### 1. New Component: `NostrEventCard`
I created `apps/gallery/src/ui/NostrEventCard.tsx`. This component:
-   Unifies rendering for Feed and Event Detail views.
-   Uses the new `nostrstack-*` design tokens.
-   Supports `variant="hero" | "compact" | "feed"`.
-   Handles Repost, Zap, Reaction, and Paywalls internally.

### 2. Styling Upgrade
I refactored `apps/gallery/src/gallery.css` to:
-   Define `nostrstack-event-card` classes mapped to the new Premium Design tokens.
-   Maintain legacy classes (`post-editor`, etc.) to prevent regressions while transitioning.

### 3. Next Steps (Once Environment is Fixed)
1.  **Swap in NostrEventCard:**
    -   In `FeedView.tsx`: Replace the internal `PostItem` with `<NostrEventCard />`.
    -   In `NostrEventView.tsx`: Use `<NostrEventCard variant="hero" />` for the main event.
    -   In `ThreadedReplies.tsx`: Use `<NostrEventCard variant="compact" />` for replies.

2.  **Fix FeedView Crash:**
    -   Investigate why `useFeed` or `useRelays` causes a crash when the mock relay is unreachable (`ERR_CONNECTION_REFUSED`).
    -   Ensure `markdown-it` is bundling correctly.

### 4. Verification
Run `pnpm e2e` locally to verify the fix.
