# NostrStack Web UX Refactor Plan

Status: Draft implementation plan for deep UX stabilization before iOS client extraction

## Sources reviewed
- React Router docs on route-driven state (single source of truth guidance): https://reactrouter.com/explanation/state-management
- React Router keyboard navigation patterns for predictable modal/route UX: https://nextstepjs.com/docs/react-router/keyboard
- React accessibility link/button guidance (semantic navigation patterns): https://rtcamp.com/handbook/react-best-practices/accessibility/

## Scope and deletion targets
1. Keep routing, feed, search, profile, relays, settings, wallet actions, and onboarding in `apps/web`.
2. Move shared domain logic from web-only UI files into a neutral `packages` layer when adding iOS later (`apps/web/src/utils`, `apps/web/src/hooks`, and `apps/web/src/layout` split by web-specific concerns).
3. Delete dead aliases once route names are finalized:
   - Remove `/find-friend` button alias after canonicalizing to `/search` in both parser and menu (optional compatibility flag can keep alias).
   - Remove duplicated modal fallback labels (`Retry route` vs `Reload page`) by centralizing retry copy.
4. Add explicit migration notes for `Sidebar` navigation expectations and any local storage keys.

## Immediate refactor done in this pass
1. Centralize route -> view map in `apps/web/src/App.tsx`.
2. Remove duplicated local navigation state and drive nav state from route parsing.
3. Route-safe `navigateTo` helper (normalizes path and avoids redundant updates).
4. Shared identity resolution cache across `useIdentityResolver` instances.
5. Shared profile display name cache in `ProfileLink`.
6. Keyboard shortcuts now route to `/help` for `?`.
7. Search submit debouncing guard added to reduce duplicate searches and disable the submit button during active search.

## 120 actionable UX improvements

### Routing + transitions (1-20)
1. **Route/view single source of truth**: derive current view from parsed route only (implemented).
2. **Deduplicate navigation calls**: short-circuit identical `navigateTo` updates (implemented).
3. Remove any direct mutation of view state in multiple places.
4. Keep canonical path constants in one module.
5. Keep alias support (`/find-friend`) behind explicit compatibility mapping.
6. Add canonical fallback route constants (`'/'`, `/search`, `/settings`, `/offers`, `/profile`, `/help`).
7. Gate route parse retries with a lightweight history-change guard.
8. Cancel in-flight route changes when component unmounts.
9. Add route transition analytics event when route changes.
10. Add a `routerBusy` state for transitions to show micro loading state in header.
11. Preserve scroll position per route in route cache.
12. Restore last known scroll position when returning to feed/search/profile.
13. Add transition class on main content root during route changes.
14. Ensure `Back`/`Forward` buttons restore sidebar selection instantly.
15. Add a dedicated `useRouteState` hook for all route checks.
16. Add `normalizePath` assertions with tests for absolute + relative + hash + query.
17. Add a route-guard that avoids invalid nested path loops.
18. Show route-not-found copy with quick links to feed/search/settings.
19. Add quick “go to feed” CTA in all recovery views.
20. Persist last valid route for recovery if a new route crashes render.

### Keyboard and command UX (21-40)
21. Add command palette for quick nav (`⌘K` for search + focus search).
22. Add `Shift+/?` tooltip on help entry points.
23. Add global `Esc` behavior to close overlays and clear focus.
24. Add repeat prevention for held keys in shortcut handler.
25. Add keyboard map settings with user-reconfigurable shortcuts.
26. Add left/right arrow support for horizontally swipable card lists.
27. Add `J`/`K` post traversal when focus is inside feed list only.
28. Add `f` to star/favorite current profile or note where relevant.
29. Add `t` for timeline back-to-top.
30. Add `c` to open compose modal quickly.
31. Add `r` for reload current route with visual progress.
32. Add `l` to list local shortcuts on help overlay.
33. Add route-aware shortcut scope (`/search` vs `/feed` behavior differences).
34. Ensure shortcuts are disabled for form inputs and contenteditable (hardened).
35. Add focus ring contrast for all keyboard focus states.
36. Add explicit `aria-keyshortcuts` attributes where supported.
37. Add audible/visual feedback for shortcut activations.
38. Add shortcut legend in onboarding tour.
39. Add mobile-friendly command fallback hint.
40. Add regression test for help shortcut + route update.

### Search and discovery UX (41-70)
41. Add search spinner to button itself to prevent duplicate clicks.
42. Disable submit when resolver is validating (implemented partially).
43. Cache most-recent search queries by category (keyword/profile/npub).
44. Deduplicate duplicate searches by last submitted query + status.
45. Add search query normalization (trim + collapse whitespace + lowercase domain).
46. Add explicit query type chips (`identity`, `keyword`, `hashtag`, `relay`).
47. Add quick clear button on search input.
48. Add suggestion dropdown from recent successful queries.
49. Add “search in notes only / identity only” toggles.
50. Add offline notice when API relay cache is stale.
51. Show note results count with live update from each relay response.
52. Persist note sort mode (recent/relevance/confidence) in route query.
53. Add search result empty-state copy by query category.
54. Add fallback search when identity query fails but keyword search can proceed.
55. Expose `search` loading with skeleton cards instead of spinner-only UI.
56. Add per-query timeout + cancel control for long-running searches.
57. Add `Load more` disable + spinner state while loading next page.
58. Add pagination state reset on route changes.
59. Add keyboard focus to first result on results load.
60. Make “Retry search” maintain active query in input automatically.
61. Add note preview cards for result items before open.
62. Add profile result confidence indicator from resolver source.
63. Add quick copy buttons for NPUB and NIP-05 in result cards.
64. Add linkification + metadata extraction for search query text.
65. Add `search` keyboard shortcut while already on search view.
66. Cache profile metadata fetch for identity lookups.
67. Add “search history” quick list with pin option.
68. Add route query param for search mode and hydration from URL.
69. Add query validation inline on invalid npub/nip05.
70. Add integration test for search route with repeated query and load state stability.

### Profile and identity display (71-90)
71. Keep profile names in a shared cross-component cache (implemented).
72. Memoize avatar loading and avoid repeated identity fallback flicker.
73. Show stable identity label while metadata resolves.
74. Prevent rapid npub↔username label switching in the same render pass.
75. Add optimistic render with loading pill for unresolved profile names.
76. Add per-profile stale-while-revalidate behavior for identity metadata.
77. Add placeholder avatar style with deterministic gradient from npub.
78. Show display-name + npub abbreviation fallback consistently.
79. Add profile hover card with follow/activity summary.
80. Add caching TTL strategy config in user settings.
81. Add explicit “copy npub” action in profile chips.
82. Preload profile route on link hover for perceived speed.
83. Add route-level cache busting when profile metadata updates.
84. Add profile error state if profile fetch fails.
85. Add explicit identity fetch source indicator (relay/API/Cache).
86. Add profile link accessibility label with role and status context.
87. Add optional `label` override precedence rules to avoid overwriting validated data.
88. Add route test for invalid profile id showing stable fallback label.
89. Add unit test coverage for shared profile cache lifetime behavior.
90. Add cleanup window for profile cache size + eviction policy.

### Layout and visual stability (91-110)
91. Add consistent page frame transitions to avoid content jump on route change.
92. Add fixed sidebar width calculations and overlay lock during route churn.
93. Add placeholder heights for feed/search cards during lazy loads.
94. Debounce header status bar updates to reduce layout shift.
95. Add explicit skip links on non-feed major routes (implemented in part).
96. Increase tap target size on mobile sidebar buttons.
97. Add micro-animation for retry/reload and route fallback fallback states.
98. Add dark/light/brand transitions with transition-safe variable updates.
99. Standardize button loading widths to reduce jitter.
100. Add unified spacing tokens across `search-view.css`, `web.css`, and component styles.
101. Add reduced-motion path for all spinners and transition states.
102. Add skeleton placeholders for relay status and telemetry sidebar.
103. Add safe handling for unknown sidebar width on very small viewports.
104. Add sticky compose control when feed length increases.
105. Add orientation-aware spacing for mobile split layouts.
106. Add focus-visible outlines for all clickable nav items.
107. Add sticky feedback banner container with smooth entry/exit.
108. Remove duplicated modal open states and derive from route + context only.
109. Add route title updates in `document.title` from route map.
110. Add loading timeout messages with abort CTA after 10+ seconds.

### Data, reliability, and performance (111-120)
111. Add memoization around large route-specific route trees.
112. Batch relay failures into one UI toast message.
113. Add route retry escalation strategy before page reload.
114. Reduce duplicate `useIdentityResolver` fetches across identical inputs (implemented).
115. Add stale cache instrumentation (cache hit ratio in dev mode).
116. Add identity fetch cancellation on route change.
117. Add circuit-breaker for repeated search failures.
118. Add graceful degradation when telemetry sidebar errors.
119. Add end-to-end checks for route churn with Playwright before merge.
120. Add CI gate that blocks regressions in route and shortcut behavior.

## Suggested execution order (phase split)
1. Phase 1: stabilize routing + keyboard behavior (items 1-20, 21-24, 101-103).
2. Phase 2: search and profile label stability (items 41-70, 71-90).
3. Phase 3: polish transitions and mobile usability (items 91-110).
4. Phase 4: accessibility/performance hardening and regression coverage (items 120).
