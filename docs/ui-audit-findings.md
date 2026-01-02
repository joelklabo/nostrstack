# Gallery UI/UX Audit Findings - 2026-01-02

## High Priority
- [ ] **Post content rendering:** Currently uses raw `{post.content}`. Needs markdown/linkification/newline handling to look "Social Network" quality.
- [ ] **Empty Wallet State:** When wallet is not configured or balance is zero, the UX is a bit dead. Could use more encouraging copy for new users.
- [ ] **Feedback on Zap:** After zapping, there is a toast, but the post itself doesn't show a "zapped" state immediately (no local cache of zaps).

## Medium Priority
- [ ] **Relay Status visibility:** The relay count is at the bottom/sidebar, but users might miss why the feed is slow. 
- [ ] **Search results:** If only a pubkey is found (no profile data), the result card is very sparse. Should fetch kind 0 metadata immediately upon resolving a pubkey in `SearchView`.
- [ ] **Identity Resolver Debounce:** The `statusLabel` says "Checking format..." during debounce. This is technically correct but might feel slightly jittery.

## Low Priority / Improvements
- [ ] **Telemetry Bar Log Limit:** Fixed at 50, but maybe could be configurable or persist longer.
- [ ] **JSON View styling:** Use a proper syntax highlighter for "Hacker Mode" instead of raw pre/code if possible.
- [ ] **Navigation feedback:** Some transitions feel a bit abrupt.

## Component Specifics
- **Sidebar:** Regtest fund button is great, but "Withdraw" button is often disabled with "Withdrawals disabled" reason which might be confusing if it's just a config thing.
- **FeedView:** Should probably implement a "Load More" or infinite scroll; currently limited to 50 items.
- **PostEditor:** Needs more validation on the text length and handle media uploads (or at least URLs).
