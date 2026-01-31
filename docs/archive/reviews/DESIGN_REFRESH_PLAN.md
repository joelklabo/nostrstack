# Personal Site Kit Design Refresh Plan

## 1. Executive Summary

The "Personal Site Kit" (SupportSection, TipWidget, Comments, etc.) needs a design refresh to meet the "BEAUTIFUL, CLEAN, and PERFORMANT" standard. Currently, styling is split between a modern token system in `packages/widgets/src/styles.ts` and legacy styles living in React SDK components. The goal is to unify these, elevate the visual quality with modern CSS features (glassmorphism, advanced gradients, fluid typography), and ensure a seamless "premium" feel across both the React SDK and the Embeddable Widgets.

## 2. Architecture & Styling Strategy

### 2.1. Single Source of Truth (SSOT)

**Current:** `packages/widgets/src/styles.ts` (Nostrstack tokens) vs legacy React SDK component styles (legacy `--color-*`).
**Target:** Consolidate ALL styling into `packages/widgets/src/styles.ts`.

- **Action:** Migrate legacy React SDK styles into the `nostrstackComponentsCss` string in `styles.ts`.
- **Action:** Replace generic `--color-*` variables with specific `--nostrstack-*` tokens.
- **Action:** Ensure the `SupportSection` (which is native React) uses the same class names and tokens as the Embed widgets to guarantee visual consistency.

### 2.2. Visual Upgrade ("Beautiful & Clean")

- **Glassmorphism:** enhance `.nostrstack-panel` and modals with `backdrop-filter: blur(12px)` and subtle `rgba` or `oklch` border transparencies.
- **Shadows:** Move from simple drop shadows to layered, colored shadows (using `color-mix` to tint shadows with the primary/accent colors).
- **Typography:** Refine hierarchy. Increase contrast for headings, use lighter weights for metadata. Ensure `Inter` is loaded or falls back gracefully.
- **Motion:** Standardize animations using `--nostrstack-motion-*` tokens. Add "micro-interactions" (e.g., button press scales, input focus rings).

## 3. Component-Specific Recommendations

### 3.1. TipWidget (The "Hero" Component)

- **Current:** Functional but visually busy.
- **Refresh:**
  - **Input:** Make the custom amount input huge and central when selected.
  - **Presets:** Turn pill buttons into a clean segmented control or "chips" with subtle gradients.
  - **Celebration:** The current "confetti" CSS is good but can be refined. Add a "success glow" pulse animation to the container upon payment.
  - **QR Code:** Hide by default behind a "Show QR" toggle or reveal on hover to keep the initial view clean.

### 3.2. SupportSection (The "Layout")

- **Current:** A grid container.
- **Refresh:**
  - **Integration:** Make the `Sidebar` (Tips + Share) and `Main` (Comments) feel like one cohesive "Dashboard" rather than separate boxes.
  - **Divider:** Replace the hard grid gap with a subtle vertical divider line in "Full" layout.
  - **Responsive:** Ensure "Compact" layout transforms gracefully into a stacked mobile view without breaking the card illusion.

### 3.3. Comments

- **Current:** Standard list.
- **Refresh:**
  - **Avatars:** Add a subtle "ring" indicating relay status or NIP-05 verification.
  - **Input:** enhancing the "Write a comment..." text area to expand on focus, with a "floating" send button that appears only when typing.

### 3.4. BlockchainStats

- **Current:** Simple grid of boxes.
- **Refresh:**
  - **Data Visualization:** Turn the simple numbers into mini "sparklines" or progress bars if applicable (e.g., for block height progress?).
  - **Pulse:** Add a live "heartbeat" animation to the block height to indicate network activity.

## 4. Performance & UX

### 4.1. Skeleton Loading

- **Problem:** The `mount*` functions cause a layout shift when they inject content.
- **Solution:** Add CSS-only "Skeleton" classes to `styles.ts`.
  - The React wrappers (`SupportSection`, `TipWidget`) should render these skeleton DOM structures _immediately_ before the `mount*` function takes over.

### 4.2. Bundle Size

- **Check:** Ensure `packages/widgets` isn't bundling unnecessary large dependencies (e.g., heavy crypto libs for QR generation) if they can be lazy-loaded.

## 5. Implementation Steps

1.  **Audit & Migrate:** Move legacy React SDK styles to `styles.ts`.
2.  **Token Refinement:** Update `nostrstackTokensCss` with new "premium" values (softer colors, better shadows).
3.  **Component Polish:** Go through `TipWidget`, `BlockchainStats`, and `Comments` in `styles.ts` and apply the new visual language.
4.  **React Updates:** Update `SupportSection.tsx` to use the new class names.
5.  **Verify:** Run `apps/gallery` to visually verify the "Personal Site Kit" demo.
