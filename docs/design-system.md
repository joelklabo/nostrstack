# nostrstack design system

nostrstack UI is token-driven so it can inherit the host site’s look while staying consistent across:

- `@nostrstack/widgets` (DOM widgets + global CSS)
- `@nostrstack/react` (React wrappers around embed)
- `apps/web` (demo + QA harness)

## Tokens (single source of truth)

The base design tokens are CSS custom properties defined in `@nostrstack/widgets`:

- Selector: `.nostrstack-theme` (and `[data-nostrstack-theme="dark"]` for dark mode)
- Prefix: `--nostrstack-*`

Key groups (non-exhaustive):

- Color roles: `--nostrstack-color-primary`, `--nostrstack-color-accent`, `--nostrstack-color-bg`, `--nostrstack-color-surface*`, `--nostrstack-color-border*`, `--nostrstack-color-text*`
- Radius: `--nostrstack-radius-sm|md|lg|pill`
- Shadow: `--nostrstack-shadow-sm|md|lg|glow|focus`
- Motion: `--nostrstack-motion-fast|base|slow|enter|exit` + easings + distances
- Spacing: `--nostrstack-space-*`

## Applying theme

### 1) Pure CSS (host site controls)

Add a wrapper and set variables:

```css
.my-site .nostrstack-theme {
  --nostrstack-color-primary: #0ea5e9;
  --nostrstack-color-accent: #a78bfa;
  --nostrstack-radius-md: 12px;
}
```

### 2) Programmatic theme (embed helpers)

`@nostrstack/widgets` exports helpers that generate the CSS vars:

- `themeToCssVars(theme)` → object of `--nostrstack-*` vars
- `themeToCss(theme, selector)` → CSS text for light/dark selectors
- `applyNostrstackTheme(el, theme)` → sets vars directly on an element
- `createNostrstackBrandTheme({ preset, mode })` → quick “brand preset” theme

## Recommended adoption strategy

### Embed

- Ensure a `.nostrstack-theme` ancestor exists (widgets do this via `ensureNostrstackRoot()`).
- Avoid hard-coded colors in widgets; use roles (e.g. `--nostrstack-color-text-muted`).

### React SDK

- `NostrstackProvider` provides `.nostrstack-theme` and sets `--nostrstack-*` vars.
- Prefer `brandPreset` + `themeMode` for quick adoption, and `nostrstackTheme` for full control.
- Legacy theme support: `theme={{ accent, text, surface, border }}` maps to the new token set and also provides legacy `--ns-*` aliases.

### Web app

- Treat as the “canary” UI: if a token is missing or a component style regresses, web should reveal it quickly.
- Prefer using `.nostrstack-*` classes from `@nostrstack/widgets` (buttons, inputs, popovers) so the demo stays representative.

## Motion presets

Guidelines:

- Default interactions: 120–180ms (`--nostrstack-motion-fast|base`) with `--nostrstack-motion-ease-standard`.
- Emphasized entrances: `--nostrstack-motion-enter` with `--nostrstack-motion-ease-emphasized`.
- Keep distances small (`--nostrstack-motion-distance-short`) to avoid “floaty” UI.
- Respect reduced motion: `@nostrstack/widgets` disables animations/transitions under `prefers-reduced-motion: reduce`.

## Primitives

Provided by `@nostrstack/widgets` CSS (no JS required):

- Buttons: `.nostrstack-btn`, `.nostrstack-btn--primary|--ghost|--sm`
- Inputs: `.nostrstack-input`, `.nostrstack-textarea`, `.nostrstack-select`
- Surfaces: `.nostrstack-card`
- Primitives: `.nostrstack-badge`, `.nostrstack-callout`

## Personal Site Kit components (planned)

Suggested class names for new widgets:

- Support section: `.nostrstack-support-section`, `.nostrstack-support-header`, `.nostrstack-support-grid`, `.nostrstack-support-sidebar`
- Tip activity feed: `.nostrstack-tip-feed`, `.nostrstack-tip-feed-item`, `.nostrstack-tip-feed-amount`, `.nostrstack-tip-feed-time`
- Share button: `.nostrstack-share`, `.nostrstack-share-button`, `.nostrstack-share-status`
- Nostr profile: `.nostrstack-profile-card`, `.nostrstack-profile-avatar`, `.nostrstack-profile-meta`, `.nostrstack-profile-actions`
- Blockchain stats: `.nostrstack-blockchain-stats`, `.nostrstack-blockchain-stat`, `.nostrstack-blockchain-value`, `.nostrstack-blockchain-label`

Status helpers (already available):

- `.nostrstack-status` with `--muted|--success|--danger`
