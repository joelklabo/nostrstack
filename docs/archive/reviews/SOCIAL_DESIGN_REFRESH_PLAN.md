# Social Design Refresh Plan

## 1. Executive Summary
The "Social" components (`FeedView`, `NostrEventView`, `ThreadedReplies`) currently use a functional but dated GitHub-inspired aesthetic defined in `gallery.css`. The goal is to bring these components up to the same "Premium" standard as the Personal Site Kit by adopting the `nostrstack-*` design tokens, unifying rendering logic, and improving performance.

## 2. Architecture & Styling Strategy

### 2.1. Unified Design System (SSOT)
**Current:** `apps/gallery/src/gallery.css` (custom variables).
**Target:** `packages/embed/src/styles.ts` (Nostrstack Tokens).
- **Action:** Refactor `gallery.css` to map its semantic classes (e.g., `.post-card`, `.reply-node`) to use `--nostrstack-*` variables.
- **Action:** Adopt the "Glassmorphism" and "Layered Shadows" from the Personal Site Kit for the main feed containers and sticky headers.

### 2.2. Component Unification
**Current:** `FeedView` uses `PostItem`. `NostrEventView` uses ad-hoc rendering logic.
**Target:** A single, powerful `<NostrEventCard />` component.
- **Action:** Extract `PostItem` from `FeedView.tsx` into `src/ui/NostrEventCard.tsx`.
- **Action:** Update `NostrEventView` to use `<NostrEventCard variant="hero" />` (larger text, full width) and `<ThreadedReplies />` to use `<NostrEventCard variant="compact" />`.

## 3. Visual Upgrade ("Beautiful & Clean")

### 3.1. Cards & Feed
- **Card:** Move from a flat border to a subtle "lifted" card style using `--nostrstack-shadow-sm` that transitions to `--nostrstack-shadow-md` on hover.
- **Avatars:** Increase size slightly (40px -> 48px) and add a "ring" for active states or relay status.
- **Actions:** Replace text/icon mix with a clean, icon-only row using `nostrstack-btn--ghost` that reveals labels/counts on hover.

### 3.2. Typography
- **Content:** Increase `line-height` (1.6) and font size (1rem) for body text. Use `Inter` variable font features if available.
- **Hierarchy:** Make names bold (`--nostrstack-font-weight-bold`) and timestamps muted/smaller.

### 3.3. Threading
- **Lines:** Replace the simple indent with a "Thread Line" (vertical rule) that connects parent avatars to children, similar to Twitter/X or Bluesky.
- **Collapse:** Allow clicking the side line to collapse a thread branch.

## 4. Performance

### 4.1. Virtualization
- **Problem:** Long threads cause DOM bloat.
- **Solution:** While full virtualization might be overkill for this sprint, implementing `content-visibility: auto` on off-screen replies is a quick win.

### 4.2. Image Optimization
- **Problem:** Layout shifts.
- **Solution:** Ensure `renderContentWithLinks` wraps images in an aspect-ratio preserving container with a blur-up placeholder or skeleton.

## 5. Implementation Steps

1.  **Refactor:** Extract `PostItem` to `src/ui/NostrEventCard.tsx`.
2.  **Style Migration:** Update `gallery.css` to use `var(--nostrstack-*)` tokens.
3.  **Visual Polish:** Implement the "Thread Line" CSS in `ThreadedReplies`.
4.  **Integration:** Update `FeedView` and `NostrEventView` to use the new `NostrEventCard`.
5.  **Verify:** Run `pnpm e2e` (specifically `social-flow.spec.ts`) to ensure no regressions.
