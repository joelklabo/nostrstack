export type NostrstackThemeMode = 'light' | 'dark';

export type NostrstackTheme = {
  mode?: NostrstackThemeMode;
  color?: Partial<{
    primary: string;
    primaryStrong: string;
    primarySoft: string;
    accent: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    bg: string;
    surface: string;
    surfaceSubtle: string;
    surfaceStrong: string;
    surfaceRaised: string;
    overlay: string;
    border: string;
    borderStrong: string;
    ring: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    textOnStrong: string;
  }>;
  radius?: Partial<{
    sm: string;
    md: string;
    lg: string;
    pill: string;
  }>;
  shadow?: Partial<{
    sm: string;
    md: string;
    lg: string;
    glow: string;
    focus: string;
  }>;
  font?: Partial<{
    body: string;
    mono: string;
  }>;
  motion?: Partial<{
    fast: string;
    base: string;
    slow: string;
    enter: string;
    exit: string;
    easeStandard: string;
    easeEmphasized: string;
    easeSnappy: string;
    distanceShort: string;
    distanceMid: string;
    distanceFar: string;
  }>;
};

const STYLE_ID = 'nostrstack-embed-styles-v2';

function setVar(el: HTMLElement, name: string, value: string | undefined) {
  if (!value) return;
  el.style.setProperty(name, value);
}

export function applyNostrstackTheme(target: HTMLElement, theme: NostrstackTheme = {}) {
  target.classList.add('nostrstack-theme');
  if (theme.mode) {
    target.setAttribute('data-nostrstack-theme', theme.mode);
  }

  const c = theme.color ?? {};
  setVar(target, '--nostrstack-color-primary', c.primary);
  setVar(target, '--nostrstack-color-primary-strong', c.primaryStrong);
  setVar(target, '--nostrstack-color-primary-soft', c.primarySoft);
  setVar(target, '--nostrstack-color-accent', c.accent);
  setVar(target, '--nostrstack-color-accent-soft', c.accentSoft);
  setVar(target, '--nostrstack-color-success', c.success);
  setVar(target, '--nostrstack-color-warning', c.warning);
  setVar(target, '--nostrstack-color-danger', c.danger);
  setVar(target, '--nostrstack-color-info', c.info);
  setVar(target, '--nostrstack-color-bg', c.bg);
  setVar(target, '--nostrstack-color-surface', c.surface);
  setVar(target, '--nostrstack-color-surface-subtle', c.surfaceSubtle);
  setVar(target, '--nostrstack-color-surface-strong', c.surfaceStrong);
  setVar(target, '--nostrstack-color-surface-raised', c.surfaceRaised);
  setVar(target, '--nostrstack-color-overlay', c.overlay);
  setVar(target, '--nostrstack-color-border', c.border);
  setVar(target, '--nostrstack-color-border-strong', c.borderStrong);
  setVar(target, '--nostrstack-color-ring', c.ring);
  setVar(target, '--nostrstack-color-text', c.text);
  setVar(target, '--nostrstack-color-text-muted', c.textMuted);
  setVar(target, '--nostrstack-color-text-subtle', c.textSubtle);
  setVar(target, '--nostrstack-color-text-on-strong', c.textOnStrong);

  const r = theme.radius ?? {};
  setVar(target, '--nostrstack-radius-sm', r.sm);
  setVar(target, '--nostrstack-radius-md', r.md);
  setVar(target, '--nostrstack-radius-lg', r.lg);
  setVar(target, '--nostrstack-radius-pill', r.pill);

  const s = theme.shadow ?? {};
  setVar(target, '--nostrstack-shadow-sm', s.sm);
  setVar(target, '--nostrstack-shadow-md', s.md);
  setVar(target, '--nostrstack-shadow-lg', s.lg);
  setVar(target, '--nostrstack-shadow-glow', s.glow);
  setVar(target, '--nostrstack-shadow-focus', s.focus);

  const f = theme.font ?? {};
  setVar(target, '--nostrstack-font-body', f.body);
  setVar(target, '--nostrstack-font-mono', f.mono);

  const m = theme.motion ?? {};
  setVar(target, '--nostrstack-motion-fast', m.fast);
  setVar(target, '--nostrstack-motion-base', m.base);
  setVar(target, '--nostrstack-motion-slow', m.slow);
  setVar(target, '--nostrstack-motion-enter', m.enter);
  setVar(target, '--nostrstack-motion-exit', m.exit);
  setVar(target, '--nostrstack-motion-ease-standard', m.easeStandard);
  setVar(target, '--nostrstack-motion-ease-emphasized', m.easeEmphasized);
  setVar(target, '--nostrstack-motion-ease-snappy', m.easeSnappy);
  setVar(target, '--nostrstack-motion-distance-short', m.distanceShort);
  setVar(target, '--nostrstack-motion-distance-mid', m.distanceMid);
  setVar(target, '--nostrstack-motion-distance-far', m.distanceFar);
}

export function themeToCssVars(theme: NostrstackTheme = {}): Record<string, string> {
  const vars: Record<string, string> = {};

  const add = (name: string, value: string | undefined) => {
    if (!value) return;
    vars[name] = value;
  };

  const c = theme.color ?? {};
  add('--nostrstack-color-primary', c.primary);
  add('--nostrstack-color-primary-strong', c.primaryStrong);
  add('--nostrstack-color-primary-soft', c.primarySoft);
  add('--nostrstack-color-accent', c.accent);
  add('--nostrstack-color-accent-soft', c.accentSoft);
  add('--nostrstack-color-success', c.success);
  add('--nostrstack-color-warning', c.warning);
  add('--nostrstack-color-danger', c.danger);
  add('--nostrstack-color-info', c.info);
  add('--nostrstack-color-bg', c.bg);
  add('--nostrstack-color-surface', c.surface);
  add('--nostrstack-color-surface-subtle', c.surfaceSubtle);
  add('--nostrstack-color-surface-strong', c.surfaceStrong);
  add('--nostrstack-color-surface-raised', c.surfaceRaised);
  add('--nostrstack-color-overlay', c.overlay);
  add('--nostrstack-color-border', c.border);
  add('--nostrstack-color-border-strong', c.borderStrong);
  add('--nostrstack-color-ring', c.ring);
  add('--nostrstack-color-text', c.text);
  add('--nostrstack-color-text-muted', c.textMuted);
  add('--nostrstack-color-text-subtle', c.textSubtle);
  add('--nostrstack-color-text-on-strong', c.textOnStrong);

  const r = theme.radius ?? {};
  add('--nostrstack-radius-sm', r.sm);
  add('--nostrstack-radius-md', r.md);
  add('--nostrstack-radius-lg', r.lg);
  add('--nostrstack-radius-pill', r.pill);

  const s = theme.shadow ?? {};
  add('--nostrstack-shadow-sm', s.sm);
  add('--nostrstack-shadow-md', s.md);
  add('--nostrstack-shadow-lg', s.lg);
  add('--nostrstack-shadow-glow', s.glow);
  add('--nostrstack-shadow-focus', s.focus);

  const f = theme.font ?? {};
  add('--nostrstack-font-body', f.body);
  add('--nostrstack-font-mono', f.mono);

  const m = theme.motion ?? {};
  add('--nostrstack-motion-fast', m.fast);
  add('--nostrstack-motion-base', m.base);
  add('--nostrstack-motion-slow', m.slow);
  add('--nostrstack-motion-enter', m.enter);
  add('--nostrstack-motion-exit', m.exit);
  add('--nostrstack-motion-ease-standard', m.easeStandard);
  add('--nostrstack-motion-ease-emphasized', m.easeEmphasized);
  add('--nostrstack-motion-ease-snappy', m.easeSnappy);
  add('--nostrstack-motion-distance-short', m.distanceShort);
  add('--nostrstack-motion-distance-mid', m.distanceMid);
  add('--nostrstack-motion-distance-far', m.distanceFar);

  return vars;
}

export function themeToCss(theme: NostrstackTheme = {}, selector = '.nostrstack-theme') {
  const vars = themeToCssVars(theme);
  const entries = Object.entries(vars);
  if (!entries.length) return '';

  const modeSelector = theme.mode ? `[data-nostrstack-theme="${theme.mode}"]` : '';
  const resolvedSelector = `${selector}${modeSelector}`;

  const lines = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  ${name}: ${value};`);
  return `${resolvedSelector} {
${lines.join('\n')}
}
`;
}

export function ensureNostrstackEmbedStyles(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined) {
  if (!doc?.head) return;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = nostrstackEmbedStyles;
  doc.head.appendChild(style);
}

export function ensureNostrstackRoot(container: HTMLElement, mode?: NostrstackThemeMode) {
  container.classList.add('nostrstack');
  if (mode) {
    container.classList.add('nostrstack-theme');
    container.setAttribute('data-nostrstack-theme', mode);
  } else if (!container.closest?.('.nostrstack-theme')) {
    container.classList.add('nostrstack-theme');
  }
  ensureNostrstackEmbedStyles(container.ownerDocument);
}

export const nostrstackTokensCss = `
:where(.nostrstack-theme) {
  /* ==== Primitive palette (light) ==== */
  /* Cooler, cleaner neutrals */
  --nostrstack-neutral-0: hsl(220 20% 99.5%);
  --nostrstack-neutral-25: hsl(220 20% 98.5%);
  --nostrstack-neutral-50: hsl(220 20% 97%);
  --nostrstack-neutral-100: hsl(220 18% 94%);
  --nostrstack-neutral-200: hsl(220 16% 88%);
  --nostrstack-neutral-300: hsl(220 14% 80%);
  --nostrstack-neutral-400: hsl(220 12% 64%);
  --nostrstack-neutral-500: hsl(220 14% 48%);
  --nostrstack-neutral-600: hsl(220 18% 36%);
  --nostrstack-neutral-700: hsl(220 24% 24%);
  --nostrstack-neutral-800: hsl(220 30% 14%);
  --nostrstack-neutral-900: hsl(220 40% 8%);
  --nostrstack-neutral-950: hsl(220 50% 4%);

  /* Vivid, electric blue primary */
  --nostrstack-brand-50: hsl(215 100% 97%);
  --nostrstack-brand-100: hsl(215 95% 92%);
  --nostrstack-brand-200: hsl(215 90% 84%);
  --nostrstack-brand-300: hsl(215 85% 74%);
  --nostrstack-brand-400: hsl(215 82% 62%);
  --nostrstack-brand-500: hsl(215 80% 50%); /* Primary */
  --nostrstack-brand-600: hsl(215 85% 42%);
  --nostrstack-brand-700: hsl(215 90% 34%);

  /* Deep purple accent */
  --nostrstack-accent-50: hsl(265 100% 97%);
  --nostrstack-accent-100: hsl(265 90% 92%);
  --nostrstack-accent-200: hsl(265 85% 84%);
  --nostrstack-accent-300: hsl(265 80% 74%);
  --nostrstack-accent-400: hsl(265 75% 64%);
  --nostrstack-accent-500: hsl(265 70% 54%);
  --nostrstack-accent-600: hsl(265 75% 44%);
  --nostrstack-accent-700: hsl(265 80% 34%);

  --nostrstack-success-500: hsl(152 65% 42%);
  --nostrstack-warning-500: hsl(35 95% 52%);
  --nostrstack-danger-500: hsl(345 80% 54%);
  --nostrstack-info-500: hsl(200 90% 50%);

  /* ==== Semantic roles (light) ==== */
  --nostrstack-color-primary: var(--nostrstack-brand-500);
  --nostrstack-color-primary-strong: var(--nostrstack-brand-600);
  --nostrstack-color-primary-soft: var(--nostrstack-brand-50);
  --nostrstack-color-accent: var(--nostrstack-accent-500);
  --nostrstack-color-accent-soft: var(--nostrstack-accent-50);
  --nostrstack-color-success: var(--nostrstack-success-500);
  --nostrstack-color-warning: var(--nostrstack-warning-500);
  --nostrstack-color-danger: var(--nostrstack-danger-500);
  --nostrstack-color-info: var(--nostrstack-info-500);

  --nostrstack-color-bg: var(--nostrstack-neutral-0);
  --nostrstack-color-surface: #ffffff;
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-50);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-100);
  --nostrstack-color-surface-raised: #ffffff;
  --nostrstack-color-overlay: hsl(220 40% 10% / 0.5);

  --nostrstack-color-border: var(--nostrstack-neutral-200);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-300);
  --nostrstack-color-ring: hsl(215 80% 50% / 0.4);

  --nostrstack-color-text: var(--nostrstack-neutral-900);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-600);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-400);
  --nostrstack-color-text-on-strong: #ffffff;

  /* Typography */
  --nostrstack-font-body: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --nostrstack-font-mono: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Motion */
  --nostrstack-motion-fast: 150ms;
  --nostrstack-motion-base: 250ms;
  --nostrstack-motion-slow: 400ms;
  --nostrstack-motion-enter: 300ms;
  --nostrstack-motion-exit: 200ms;
  --nostrstack-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --nostrstack-motion-ease-emphasized: cubic-bezier(0.25, 0, 0, 1);
  --nostrstack-motion-ease-snappy: cubic-bezier(0.19, 1, 0.22, 1);
  --nostrstack-motion-distance-short: 4px;
  --nostrstack-motion-distance-mid: 12px;
  --nostrstack-motion-distance-far: 24px;

  /* Density + spacing (4px base) */
  --nostrstack-density-scale: 1;
  --nostrstack-space-0: 0px;
  --nostrstack-space-1: calc(4px * var(--nostrstack-density-scale));
  --nostrstack-space-2: calc(8px * var(--nostrstack-density-scale));
  --nostrstack-space-3: calc(12px * var(--nostrstack-density-scale));
  --nostrstack-space-4: calc(16px * var(--nostrstack-density-scale));
  --nostrstack-space-5: calc(24px * var(--nostrstack-density-scale));
  --nostrstack-space-6: calc(32px * var(--nostrstack-density-scale));
  --nostrstack-space-8: calc(48px * var(--nostrstack-density-scale));
  --nostrstack-space-10: calc(64px * var(--nostrstack-density-scale));
  --nostrstack-space-12: calc(80px * var(--nostrstack-density-scale));

  /* Radii */
  --nostrstack-radius-sm: 6px;
  --nostrstack-radius-md: 10px;
  --nostrstack-radius-lg: 16px;
  --nostrstack-radius-pill: 999px;

  /* Shadows - Layered & Smooth */
  --nostrstack-shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 0.1), 0 1px 3px 0 rgb(0 0 0 / 0.1);
  --nostrstack-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --nostrstack-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --nostrstack-shadow-glow: 0 0 0 1px hsl(215 80% 50% / 0.2), 0 0 16px -2px hsl(215 80% 50% / 0.25);
  --nostrstack-shadow-focus: 0 0 0 3px var(--nostrstack-color-ring);
  --nostrstack-shadow-premium: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}

:where(.nostrstack-theme[data-nostrstack-theme="dark"]) {
  /* ==== Primitive palette (dark) ==== */
  --nostrstack-neutral-0: hsl(220 25% 4%);
  --nostrstack-neutral-25: hsl(220 25% 6%);
  --nostrstack-neutral-50: hsl(220 25% 8%);
  --nostrstack-neutral-100: hsl(220 20% 12%);
  --nostrstack-neutral-200: hsl(220 20% 16%);
  --nostrstack-neutral-300: hsl(220 18% 24%);
  --nostrstack-neutral-400: hsl(220 16% 36%);
  --nostrstack-neutral-500: hsl(220 16% 48%);
  --nostrstack-neutral-600: hsl(220 16% 60%);
  --nostrstack-neutral-700: hsl(220 18% 72%);
  --nostrstack-neutral-800: hsl(220 20% 84%);
  --nostrstack-neutral-900: hsl(220 30% 96%);
  --nostrstack-neutral-950: hsl(0 0% 100%);

  /* Vivid primary for dark mode */
  --nostrstack-brand-50: hsl(215 80% 15%);
  --nostrstack-brand-100: hsl(215 80% 20%);
  --nostrstack-brand-200: hsl(215 80% 30%);
  --nostrstack-brand-300: hsl(215 80% 40%);
  --nostrstack-brand-400: hsl(215 80% 50%);
  --nostrstack-brand-500: hsl(215 85% 60%); /* Primary Dark */
  --nostrstack-brand-600: hsl(215 85% 70%);
  --nostrstack-brand-700: hsl(215 85% 80%);

  /* Accent for dark mode */
  --nostrstack-accent-50: hsl(265 80% 15%);
  --nostrstack-accent-100: hsl(265 80% 20%);
  --nostrstack-accent-200: hsl(265 80% 30%);
  --nostrstack-accent-300: hsl(265 80% 40%);
  --nostrstack-accent-400: hsl(265 80% 50%);
  --nostrstack-accent-500: hsl(265 85% 64%);
  --nostrstack-accent-600: hsl(265 85% 74%);
  --nostrstack-accent-700: hsl(265 85% 84%);

  --nostrstack-success-500: hsl(152 70% 48%);
  --nostrstack-warning-500: hsl(35 95% 58%);
  --nostrstack-danger-500: hsl(345 85% 60%);
  --nostrstack-info-500: hsl(200 95% 58%);

  /* ==== Semantic roles (dark) ==== */
  --nostrstack-color-primary: var(--nostrstack-brand-500);
  --nostrstack-color-primary-strong: var(--nostrstack-brand-400);
  --nostrstack-color-primary-soft: var(--nostrstack-brand-50);
  --nostrstack-color-accent: var(--nostrstack-accent-500);
  --nostrstack-color-accent-soft: var(--nostrstack-accent-50);

  --nostrstack-color-bg: var(--nostrstack-neutral-0);
  --nostrstack-color-surface: var(--nostrstack-neutral-25);
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-50);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-100);
  --nostrstack-color-surface-raised: var(--nostrstack-neutral-100);
  --nostrstack-color-overlay: hsl(220 40% 6% / 0.8);

  --nostrstack-color-border: var(--nostrstack-neutral-200);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-300);
  --nostrstack-color-ring: hsl(215 85% 60% / 0.4);

  --nostrstack-color-text: var(--nostrstack-neutral-900);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-500);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-400);
  --nostrstack-color-text-on-strong: hsl(220 30% 6%);

  --nostrstack-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
  --nostrstack-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --nostrstack-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
  --nostrstack-shadow-glow: 0 0 0 1px hsl(215 85% 60% / 0.2), 0 0 20px -2px hsl(215 85% 60% / 0.2);
  --nostrstack-shadow-premium: 0 20px 30px -5px rgb(0 0 0 / 0.6);
}
`;

export const nostrstackComponentsCss = `
:where(.nostrstack) {
  color: var(--nostrstack-color-text);
  font-family: var(--nostrstack-font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:where(.nostrstack), :where(.nostrstack *) { box-sizing: border-box; }

:where(.nostrstack) :where(button, input, textarea, select) {
  font: inherit;
}

:where(.nostrstack) :where(a) {
  color: var(--nostrstack-color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
}
:where(.nostrstack) :where(a):hover {
  color: var(--nostrstack-color-primary-strong);
  text-decoration: underline;
}

/* ===== Utils ===== */
.nostrstack-glass {
  background: color-mix(in oklab, var(--nostrstack-color-surface) 80%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid color-mix(in oklab, var(--nostrstack-color-border) 60%, transparent);
}
.nostrstack-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nostrstack-grid-center { display: grid; place-items: center; }

/* ===== Buttons ===== */
.nostrstack-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.1rem;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
  box-shadow: var(--nostrstack-shadow-sm);
  user-select: none;
}

.nostrstack-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--nostrstack-shadow-md);
  border-color: var(--nostrstack-color-border-strong);
  background: var(--nostrstack-color-surface-raised);
}

.nostrstack-btn:active:not(:disabled) {
  transform: translateY(0);
}

.nostrstack-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  background: var(--nostrstack-color-surface-subtle);
}

.nostrstack-btn:focus-visible {
  outline: none;
  box-shadow: var(--nostrstack-shadow-focus), var(--nostrstack-shadow-sm);
}

.nostrstack-btn--primary {
  background: var(--nostrstack-color-primary);
  border-color: var(--nostrstack-color-primary);
  color: var(--nostrstack-color-text-on-strong);
  box-shadow: 0 4px 10px color-mix(in oklab, var(--nostrstack-color-primary) 40%, transparent);
}

.nostrstack-btn--primary:hover:not(:disabled) {
  background: var(--nostrstack-color-primary-strong);
  border-color: var(--nostrstack-color-primary-strong);
  box-shadow: 0 6px 14px color-mix(in oklab, var(--nostrstack-color-primary) 50%, transparent);
}

.nostrstack-btn--ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--nostrstack-color-text-muted);
}
.nostrstack-btn--ghost:hover:not(:disabled) {
  background: var(--nostrstack-color-surface-subtle);
  color: var(--nostrstack-color-text);
  box-shadow: none;
  transform: none;
}

.nostrstack-btn--sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  border-radius: var(--nostrstack-radius-sm);
}

/* ===== Inputs ===== */
.nostrstack-input, .nostrstack-textarea {
  width: 100%;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  padding: 0.6rem 0.8rem;
  font-size: 0.95rem;
  transition: all var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
}
.nostrstack-input:focus, .nostrstack-textarea:focus {
  outline: none;
  border-color: var(--nostrstack-color-primary);
  box-shadow: var(--nostrstack-shadow-focus);
}
.nostrstack-textarea { resize: vertical; min-height: 80px; }

/* ===== Cards ===== */
.nostrstack-card {
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  background: var(--nostrstack-color-surface);
  box-shadow: var(--nostrstack-shadow-md);
  overflow: hidden;
}

/* ===== Support Grid (Migrated from legacy) ===== */
.nostrstack-support-section {
  width: 100%;
  max-width: 100%;
}
.nostrstack-support-grid {
  display: grid;
  gap: var(--nostrstack-space-4);
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
}
@media (max-width: 800px) {
  .nostrstack-support-grid { grid-template-columns: 1fr; }
}

/* ===== Payment Modal (Migrated & Refreshed) ===== */
.nostrstack-payment-overlay {
  position: fixed;
  inset: 0;
  background: var(--nostrstack-color-overlay);
  display: grid;
  place-items: center;
  padding: var(--nostrstack-space-4);
  z-index: 9999;
  animation: nostrstack-fade-in var(--nostrstack-motion-base) ease-out;
  backdrop-filter: blur(4px);
}

.nostrstack-payment-modal {
  width: min(720px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--nostrstack-color-surface);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  box-shadow: var(--nostrstack-shadow-premium);
  overflow: hidden;
  animation: nostrstack-pop-in var(--nostrstack-motion-enter) var(--nostrstack-motion-ease-emphasized);
}

.nostrstack-payment-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--nostrstack-space-4);
  padding: var(--nostrstack-space-4) var(--nostrstack-space-5);
  background: var(--nostrstack-color-surface-subtle);
  border-bottom: 1px solid var(--nostrstack-color-border);
}

.nostrstack-payment-title {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--nostrstack-color-text);
  margin-bottom: 2px;
}

.nostrstack-payment-subtitle {
  font-size: 0.8rem;
  font-family: var(--nostrstack-font-mono);
  color: var(--nostrstack-color-text-muted);
}

.nostrstack-payment-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--nostrstack-color-text-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all var(--nostrstack-motion-fast);
}
.nostrstack-payment-close:hover {
  background: var(--nostrstack-color-surface-strong);
  color: var(--nostrstack-color-text);
}

.nostrstack-payment-body {
  padding: var(--nostrstack-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--nostrstack-space-4);
  overflow-y: auto;
}

.nostrstack-payment-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: var(--nostrstack-radius-md);
  background: var(--nostrstack-color-surface-subtle);
  border: 1px solid var(--nostrstack-color-border);
  color: var(--nostrstack-color-text-muted);
  width: fit-content;
}

.nostrstack-payment-status[data-status="success"] {
  background: color-mix(in oklab, var(--nostrstack-color-success) 10%, var(--nostrstack-color-surface));
  border-color: color-mix(in oklab, var(--nostrstack-color-success) 30%, transparent);
  color: var(--nostrstack-color-success);
}

.nostrstack-payment-status[data-status="error"] {
  background: color-mix(in oklab, var(--nostrstack-color-danger) 10%, var(--nostrstack-color-surface));
  border-color: color-mix(in oklab, var(--nostrstack-color-danger) 30%, transparent);
  color: var(--nostrstack-color-danger);
}

.nostrstack-payment-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--nostrstack-color-border-strong);
  border-top-color: var(--nostrstack-color-primary);
  animation: nostrstack-spin 0.8s linear infinite;
}

.nostrstack-payment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--nostrstack-space-4);
  align-items: start;
}

.nostrstack-payment-qr {
  padding: var(--nostrstack-space-3);
  background: white;
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
  box-shadow: var(--nostrstack-shadow-md);
  aspect-ratio: 1/1;
  display: grid;
  place-items: center;
}
.nostrstack-payment-qr svg { width: 100%; height: 100%; display: block; }

.nostrstack-payment-panel {
  display: flex;
  flex-direction: column;
  gap: var(--nostrstack-space-3);
  padding: var(--nostrstack-space-4);
  background: var(--nostrstack-color-surface-subtle);
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
}

.nostrstack-payment-invoice-box {
  padding: var(--nostrstack-space-3);
  background: var(--nostrstack-color-surface);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-md);
  font-family: var(--nostrstack-font-mono);
  font-size: 0.8rem;
  color: var(--nostrstack-color-text-subtle);
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}

.nostrstack-payment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nostrstack-space-2);
}

/* ===== Tip Widget (Refreshed) ===== */
.nostrstack-tip {
  padding: var(--nostrstack-space-5);
  display: grid;
  gap: var(--nostrstack-space-4);
  position: relative;
  container-type: inline-size;
}

.nostrstack-tip__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nostrstack-tip__headerLeft { display: flex; flex-direction: column; gap: 2px; }
.nostrstack-tip__sub { font-size: 0.85rem; color: var(--nostrstack-color-text-muted); font-weight: 500; }

.nostrstack-tip__title {
  font-size: 1.1rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.nostrstack-tip__titleIcon { color: var(--nostrstack-color-warning); }

.nostrstack-tip__amountRow {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nostrstack-space-2);
}

.nostrstack-tip__amt {
  flex: 1;
  min-width: 60px;
  text-align: center;
  padding: 0.6rem 0.4rem;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--nostrstack-motion-fast);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.nostrstack-tip__amtLabel { pointer-events: none; }

.nostrstack-tip__amt:hover {
  border-color: var(--nostrstack-color-border-strong);
  background: var(--nostrstack-color-surface-subtle);
  transform: translateY(-1px);
}
.nostrstack-tip__amt[data-selected="true"] {
  background: var(--nostrstack-color-primary);
  border-color: var(--nostrstack-color-primary);
  color: var(--nostrstack-color-text-on-strong);
  box-shadow: 0 4px 12px color-mix(in oklab, var(--nostrstack-color-primary) 30%, transparent);
}

.nostrstack-tip__custom {
  display: flex;
  gap: var(--nostrstack-space-2);
  width: 100%;
}

.nostrstack-tip__panel {
  position: relative;
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  padding: var(--nostrstack-space-4);
  display: grid;
  gap: var(--nostrstack-space-4);
  grid-template-areas: "ring status" "qr qr" "actions actions";
  grid-template-columns: auto 1fr;
  align-items: center;
  overflow: hidden;
  transition: all var(--nostrstack-motion-base);
}
.nostrstack-tip__panel[data-state="initial"] { display: none; }
.nostrstack-tip__panel[data-state="waiting"] {
  border-color: var(--nostrstack-color-primary);
  box-shadow: 0 0 0 1px var(--nostrstack-color-primary), var(--nostrstack-shadow-lg);
}
.nostrstack-tip__panel[data-state="paid"] {
  border-color: var(--nostrstack-color-success);
  background: radial-gradient(circle at center, color-mix(in oklab, var(--nostrstack-color-success) 5%, transparent), var(--nostrstack-color-surface));
}

.nostrstack-tip__ring { grid-area: ring; width: 64px; height: 64px; display: grid; place-items: center; position: relative; }
.nostrstack-tip__ringSvg { width: 100%; height: 100%; transform: rotate(-90deg); position: absolute; inset: 0; }
.nostrstack-tip__ringBg { fill: none; stroke: var(--nostrstack-color-surface-strong); stroke-width: 4; }
.nostrstack-tip__ringProgress {
  fill: none;
  stroke: var(--nostrstack-color-primary);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 188.5;
  stroke-dashoffset: var(--ring-offset, 0);
  transition: stroke-dashoffset 1s linear;
}
.nostrstack-tip__panel[data-state="paid"] .nostrstack-tip__ringProgress { stroke: var(--nostrstack-color-success); }
.nostrstack-tip__ringCenter { position: relative; z-index: 1; font-weight: 800; font-size: 1.1rem; }

.nostrstack-tip__qr {
  grid-area: qr;
  width: 100%;
  max-width: 240px;
  margin: 0 auto;
  padding: 0.5rem;
  background: white;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
}
.nostrstack-tip__qr img, .nostrstack-tip__qr svg { width: 100%; display: block; }

.nostrstack-tip__actions { grid-area: actions; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }

.nostrstack-invoice-icon { display: flex; align-items: center; color: var(--nostrstack-color-text-muted); }
.nostrstack-invoice-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--nostrstack-color-text-muted); }


/* Confetti & Animations */
@keyframes nostrstack-spin { to { transform: rotate(360deg); } }
@keyframes nostrstack-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes nostrstack-pop-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ===== Compact Mode ===== */
.nostrstack-tip--compact {
  padding: var(--nostrstack-space-3);
  gap: var(--nostrstack-space-3);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  background: var(--nostrstack-color-surface);
}
.nostrstack-tip--compact .nostrstack-tip__panel {
  grid-template-areas: "status" "qr" "ring" "actions";
  grid-template-columns: 1fr;
  text-align: center;
}
.nostrstack-tip--compact .nostrstack-tip__ring { margin: 0 auto; }

/* ===== Comments ===== */
.nostrstack-comments { display: flex; flex-direction: column; gap: var(--nostrstack-space-3); }
.nostrstack-comment {
  padding: var(--nostrstack-space-3);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-md);
  background: var(--nostrstack-color-surface);
  transition: all var(--nostrstack-motion-fast);
}
.nostrstack-comment:hover {
  box-shadow: var(--nostrstack-shadow-md);
  border-color: var(--nostrstack-color-border-strong);
}

/* ===== Skeleton Loading (New) ===== */
.nostrstack-skeleton {
  background: var(--nostrstack-color-surface-strong);
  border-radius: var(--nostrstack-radius-sm);
  animation: nostrstack-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes nostrstack-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.nostrstack-skeleton-text { height: 1em; width: 80%; margin-bottom: 0.5em; }
.nostrstack-skeleton-rect { width: 100%; height: 200px; border-radius: var(--nostrstack-radius-lg); }
`;

export const nostrstackEmbedStyles = `${nostrstackTokensCss}\n${nostrstackComponentsCss}`;