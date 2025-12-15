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
  return `${resolvedSelector} {\n${lines.join('\n')}\n}\n`;
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
  --nostrstack-neutral-0: hsl(220 30% 99%);
  --nostrstack-neutral-25: hsl(220 30% 98%);
  --nostrstack-neutral-50: hsl(220 28% 96%);
  --nostrstack-neutral-100: hsl(220 22% 92%);
  --nostrstack-neutral-200: hsl(220 18% 86%);
  --nostrstack-neutral-300: hsl(220 16% 78%);
  --nostrstack-neutral-400: hsl(222 14% 62%);
  --nostrstack-neutral-500: hsl(222 16% 48%);
  --nostrstack-neutral-600: hsl(222 22% 38%);
  --nostrstack-neutral-700: hsl(222 34% 24%);
  --nostrstack-neutral-800: hsl(222 42% 14%);
  --nostrstack-neutral-900: hsl(222 50% 9%);
  --nostrstack-neutral-950: hsl(222 58% 5%);

  --nostrstack-brand-50: hsl(198 100% 96%);
  --nostrstack-brand-100: hsl(198 95% 90%);
  --nostrstack-brand-200: hsl(198 92% 82%);
  --nostrstack-brand-300: hsl(198 90% 72%);
  --nostrstack-brand-400: hsl(198 88% 62%);
  --nostrstack-brand-500: hsl(198 85% 52%);
  --nostrstack-brand-600: hsl(198 87% 42%);
  --nostrstack-brand-700: hsl(198 90% 34%);

  --nostrstack-accent-50: hsl(258 100% 96%);
  --nostrstack-accent-100: hsl(258 96% 90%);
  --nostrstack-accent-200: hsl(258 90% 84%);
  --nostrstack-accent-300: hsl(258 88% 76%);
  --nostrstack-accent-400: hsl(258 86% 70%);
  --nostrstack-accent-500: hsl(258 82% 66%);
  --nostrstack-accent-600: hsl(258 80% 58%);
  --nostrstack-accent-700: hsl(258 78% 50%);

  --nostrstack-success-500: hsl(157 60% 46%);
  --nostrstack-warning-500: hsl(38 92% 50%);
  --nostrstack-danger-500: hsl(349 74% 52%);
  --nostrstack-info-500: hsl(210 90% 55%);

  /* ==== Semantic roles (light) ==== */
  --nostrstack-color-primary: var(--nostrstack-brand-500);
  --nostrstack-color-primary-strong: var(--nostrstack-brand-600);
  --nostrstack-color-primary-soft: var(--nostrstack-brand-100);
  --nostrstack-color-accent: var(--nostrstack-accent-500);
  --nostrstack-color-accent-soft: var(--nostrstack-accent-100);
  --nostrstack-color-success: var(--nostrstack-success-500);
  --nostrstack-color-warning: var(--nostrstack-warning-500);
  --nostrstack-color-danger: var(--nostrstack-danger-500);
  --nostrstack-color-info: var(--nostrstack-info-500);

  --nostrstack-color-bg: var(--nostrstack-neutral-25);
  --nostrstack-color-surface: var(--nostrstack-neutral-0);
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-50);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-100);
  --nostrstack-color-surface-raised: var(--nostrstack-neutral-0);
  --nostrstack-color-overlay: hsl(222 50% 8% / 0.45);

  --nostrstack-color-border: var(--nostrstack-neutral-200);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-300);
  --nostrstack-color-ring: hsl(198 85% 52% / 0.55);

  --nostrstack-color-text: var(--nostrstack-neutral-900);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-600);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-500);
  --nostrstack-color-text-on-strong: hsl(0 0% 100%);

  /* Typography */
  --nostrstack-font-body: Inter, system-ui, sans-serif;
  --nostrstack-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  /* Motion */
  --nostrstack-motion-fast: 120ms;
  --nostrstack-motion-base: 180ms;
  --nostrstack-motion-slow: 260ms;
  --nostrstack-motion-enter: 220ms;
  --nostrstack-motion-exit: 150ms;
  --nostrstack-motion-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
  --nostrstack-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --nostrstack-motion-ease-snappy: cubic-bezier(0.34, 1.56, 0.64, 1);
  --nostrstack-motion-distance-short: 6px;
  --nostrstack-motion-distance-mid: 16px;
  --nostrstack-motion-distance-far: 32px;

  /* Density + spacing (4px base) */
  --nostrstack-density-scale: 1;
  --nostrstack-space-0: 0px;
  --nostrstack-space-1: calc(4px * var(--nostrstack-density-scale));
  --nostrstack-space-2: calc(8px * var(--nostrstack-density-scale));
  --nostrstack-space-3: calc(12px * var(--nostrstack-density-scale));
  --nostrstack-space-4: calc(16px * var(--nostrstack-density-scale));
  --nostrstack-space-5: calc(20px * var(--nostrstack-density-scale));
  --nostrstack-space-6: calc(24px * var(--nostrstack-density-scale));
  --nostrstack-space-8: calc(32px * var(--nostrstack-density-scale));
  --nostrstack-space-10: calc(40px * var(--nostrstack-density-scale));
  --nostrstack-space-12: calc(48px * var(--nostrstack-density-scale));

  /* Radii */
  --nostrstack-radius-sm: 8px;
  --nostrstack-radius-md: 12px;
  --nostrstack-radius-lg: 16px;
  --nostrstack-radius-pill: 999px;

  /* Shadows */
  --nostrstack-shadow-sm: 0 1px 2px hsl(222 47% 11% / 0.04);
  --nostrstack-shadow-md: 0 2px 8px hsl(222 47% 11% / 0.07);
  --nostrstack-shadow-lg: 0 10px 30px hsl(222 47% 11% / 0.10);
  --nostrstack-shadow-glow: 0 0 0 1px hsl(198 85% 52% / 0.18), 0 10px 30px hsl(222 47% 11% / 0.10);
  --nostrstack-shadow-focus: 0 0 0 3px var(--nostrstack-color-ring);
}

:where(.nostrstack-theme[data-nostrstack-theme="dark"]) {
  /* ==== Primitive palette (dark) ==== */
  --nostrstack-neutral-0: hsl(220 18% 6%);
  --nostrstack-neutral-25: hsl(220 18% 8%);
  --nostrstack-neutral-50: hsl(220 18% 10%);
  --nostrstack-neutral-100: hsl(220 16% 14%);
  --nostrstack-neutral-200: hsl(220 16% 18%);
  --nostrstack-neutral-300: hsl(220 16% 22%);
  --nostrstack-neutral-400: hsl(220 16% 28%);
  --nostrstack-neutral-500: hsl(220 18% 38%);
  --nostrstack-neutral-600: hsl(220 15% 64%);
  --nostrstack-neutral-700: hsl(220 15% 74%);
  --nostrstack-neutral-800: hsl(220 20% 84%);
  --nostrstack-neutral-900: hsl(220 33% 92%);
  --nostrstack-neutral-950: hsl(0 0% 100%);

  --nostrstack-brand-50: hsl(198 80% 22% / 0.7);
  --nostrstack-brand-100: hsl(198 82% 28% / 0.55);
  --nostrstack-brand-200: hsl(198 84% 36%);
  --nostrstack-brand-300: hsl(198 86% 48%);
  --nostrstack-brand-400: hsl(198 86% 56%);
  --nostrstack-brand-500: hsl(198 86% 62%);
  --nostrstack-brand-600: hsl(198 88% 72%);
  --nostrstack-brand-700: hsl(198 90% 80%);

  --nostrstack-accent-50: hsl(258 84% 28% / 0.55);
  --nostrstack-accent-100: hsl(258 86% 36% / 0.6);
  --nostrstack-accent-200: hsl(258 88% 46%);
  --nostrstack-accent-300: hsl(258 90% 56%);
  --nostrstack-accent-400: hsl(258 92% 64%);
  --nostrstack-accent-500: hsl(258 85% 72%);
  --nostrstack-accent-600: hsl(258 88% 78%);
  --nostrstack-accent-700: hsl(258 90% 84%);

  --nostrstack-success-500: hsl(157 58% 56%);
  --nostrstack-warning-500: hsl(38 95% 60%);
  --nostrstack-danger-500: hsl(349 76% 62%);
  --nostrstack-info-500: hsl(210 92% 70%);

  /* ==== Semantic roles (dark) ==== */
  --nostrstack-color-primary: var(--nostrstack-brand-500);
  --nostrstack-color-primary-strong: var(--nostrstack-brand-600);
  --nostrstack-color-primary-soft: var(--nostrstack-brand-50);
  --nostrstack-color-accent: var(--nostrstack-accent-500);
  --nostrstack-color-accent-soft: var(--nostrstack-accent-50);

  --nostrstack-color-bg: var(--nostrstack-neutral-0);
  --nostrstack-color-surface: var(--nostrstack-neutral-50);
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-100);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-200);
  --nostrstack-color-surface-raised: var(--nostrstack-neutral-300);
  --nostrstack-color-overlay: hsl(220 32% 4% / 0.72);

  --nostrstack-color-border: var(--nostrstack-neutral-400);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-500);
  --nostrstack-color-ring: hsl(198 88% 65% / 0.45);

  --nostrstack-color-text: var(--nostrstack-neutral-900);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-700);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-600);
  --nostrstack-color-text-on-strong: hsl(220 16% 12%);

  --nostrstack-shadow-sm: 0 1px 2px hsl(220 33% 3% / 0.6);
  --nostrstack-shadow-md: 0 2px 8px hsl(220 33% 3% / 0.7);
  --nostrstack-shadow-lg: 0 10px 30px hsl(220 33% 3% / 0.8);
  --nostrstack-shadow-glow: 0 0 0 1px hsl(198 88% 65% / 0.18), 0 10px 30px hsl(220 33% 3% / 0.7);
  --nostrstack-shadow-focus: 0 0 0 3px var(--nostrstack-color-ring);
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
  color: var(--nostrstack-color-primary-strong);
}

.nostrstack-btn--sm { padding: 0.35rem 0.65rem; border-radius: var(--nostrstack-radius-sm); font-size: 0.92rem; }
.nostrstack-btn--ghost { background: transparent; box-shadow: none; }
.nostrstack-btn--ghost:hover { background: color-mix(in oklab, var(--nostrstack-color-surface-strong) 65%, transparent); }

.nostrstack-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.55rem 0.95rem;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  cursor: pointer;
  transition:
    transform var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    box-shadow var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    border-color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    background var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
  box-shadow: var(--nostrstack-shadow-sm);
}

.nostrstack-btn:hover { transform: translateY(-1px); box-shadow: var(--nostrstack-shadow-md); border-color: var(--nostrstack-color-border-strong); }
.nostrstack-btn:active { transform: translateY(0); }
.nostrstack-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
.nostrstack-btn:focus-visible { outline: none; box-shadow: var(--nostrstack-shadow-focus), var(--nostrstack-shadow-md); }

.nostrstack-btn--primary {
  background: linear-gradient(135deg, var(--nostrstack-color-primary), var(--nostrstack-color-accent));
  border-color: color-mix(in oklab, var(--nostrstack-color-primary) 40%, var(--nostrstack-color-border));
  color: var(--nostrstack-color-text-on-strong);
  box-shadow: var(--nostrstack-shadow-glow);
}
.nostrstack-btn--primary:hover { filter: saturate(1.03); }

.nostrstack-input, .nostrstack-textarea, .nostrstack-select {
  width: 100%;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  padding: 0.55rem 0.75rem;
  transition: border-color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard), box-shadow var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
}
.nostrstack-input:focus, .nostrstack-textarea:focus, .nostrstack-select:focus { outline: none; box-shadow: var(--nostrstack-shadow-focus); border-color: var(--nostrstack-color-border-strong); }

.nostrstack-select {
  appearance: none;
  padding-right: 2.15rem;
  background-image:
    linear-gradient(45deg, transparent 50%, color-mix(in oklab, var(--nostrstack-color-text) 65%, transparent) 50%),
    linear-gradient(135deg, color-mix(in oklab, var(--nostrstack-color-text) 65%, transparent) 50%, transparent 50%),
    linear-gradient(to right, color-mix(in oklab, var(--nostrstack-color-border-strong) 55%, transparent), color-mix(in oklab, var(--nostrstack-color-border-strong) 55%, transparent));
  background-position: calc(100% - 0.85rem) calc(50% - 2px), calc(100% - 0.75rem) calc(50% - 2px), calc(100% - 2.05rem) 50%;
  background-size: 6px 6px, 6px 6px, 1px 1.4em;
  background-repeat: no-repeat;
}

.nostrstack-card {
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  background: var(--nostrstack-color-surface);
  box-shadow: var(--nostrstack-shadow-md);
}

.nostrstack-muted { color: var(--nostrstack-color-text-muted); }
.nostrstack-code { font-family: var(--nostrstack-font-mono); }
.nostrstack-status { font-weight: 700; font-size: 0.92rem; line-height: 1.25; }
.nostrstack-status--muted { color: var(--nostrstack-color-text-muted); }
.nostrstack-status--success { color: var(--nostrstack-color-success); }
.nostrstack-status--danger { color: var(--nostrstack-color-danger); }

/* ===== Primitives ===== */
.nostrstack-badge {
  --nostrstack-badge-tone: var(--nostrstack-color-text-subtle);

  display: inline-flex;
  align-items: center;
  gap: var(--nostrstack-space-2);
  padding: 0.22rem 0.6rem;
  border-radius: var(--nostrstack-radius-pill);
  border: 1px solid color-mix(in oklab, var(--nostrstack-badge-tone) 35%, var(--nostrstack-color-border));
  background: color-mix(in oklab, var(--nostrstack-badge-tone) 12%, var(--nostrstack-color-surface));
  color: color-mix(in oklab, var(--nostrstack-badge-tone) 70%, var(--nostrstack-color-text));
  font-weight: 800;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  box-shadow: var(--nostrstack-shadow-sm);
  user-select: none;
}

.nostrstack-callout {
  --nostrstack-callout-tone: var(--nostrstack-color-accent);

  padding: var(--nostrstack-space-4);
  border-radius: var(--nostrstack-radius-lg);
  background: color-mix(in oklab, var(--nostrstack-callout-tone) 10%, var(--nostrstack-color-surface));
  border: 1px solid color-mix(in oklab, var(--nostrstack-callout-tone) 30%, var(--nostrstack-color-border));
  color: var(--nostrstack-color-text);
  box-shadow: var(--nostrstack-shadow-sm);
  transition:
    border-color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    background var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
}

.nostrstack-callout__title {
  font-weight: 900;
  letter-spacing: 0.01em;
}

.nostrstack-callout__content {
  margin-top: var(--nostrstack-space-2);
}

/* ===== Relay badge ===== */
.nostrstack-relay-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.28rem 0.65rem;
  border-radius: var(--nostrstack-radius-pill);
  background: color-mix(in oklab, var(--nostrstack-color-surface-strong) 60%, transparent);
  color: var(--nostrstack-color-text);
  font-size: 12px;
  border: 1px solid var(--nostrstack-color-border);
  box-shadow: var(--nostrstack-shadow-sm);
  backdrop-filter: blur(6px);
}
.nostrstack-relay-badge .relay-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--nostrstack-radius-pill);
  background: var(--nostrstack-color-warning);
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--nostrstack-color-warning) 55%, transparent);
  animation: nostrstack-pulse 2s infinite;
}
.nostrstack-relay-badge[data-mode="mock"] .relay-dot {
  background: var(--nostrstack-color-text-subtle);
  animation: none;
  box-shadow: none;
}
.nostrstack-relay-badge[data-mode="real"] .relay-dot {
  background: var(--nostrstack-color-success);
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--nostrstack-color-success) 55%, transparent);
  animation: nostrstack-pulse 2s infinite;
}

@keyframes nostrstack-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--nostrstack-color-success) 45%, transparent); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* ===== Nostr user card ===== */
.nostrstack-user-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--nostrstack-color-surface);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  box-shadow: var(--nostrstack-shadow-md);
}
.nostrstack-user-card .user-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--nostrstack-radius-pill);
  background: var(--nostrstack-color-surface-strong);
  background-size: cover;
  background-position: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--nostrstack-color-text);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--nostrstack-color-primary) 22%, transparent);
}
.nostrstack-user-card .user-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.nostrstack-user-card .user-name { font-weight: 800; color: var(--nostrstack-color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nostrstack-user-card .user-sub { font-size: 12px; color: var(--nostrstack-color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nostrstack-user-card .user-about { font-size: 12px; color: var(--nostrstack-color-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ===== Invoice popover ===== */
.nostrstack-popover-overlay {
  position: fixed;
  inset: 0;
  background: var(--nostrstack-color-overlay);
  display: grid;
  place-items: center;
  z-index: 9999;
  animation: nostrstack-fade-in var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
}
.nostrstack-popover {
  width: min(560px, 92vw);
  border-radius: var(--nostrstack-radius-lg);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  border: 1px solid var(--nostrstack-color-border);
  box-shadow: var(--nostrstack-shadow-lg);
  padding: 1.15rem 1.35rem;
  animation: nostrstack-pop-in var(--nostrstack-motion-enter) var(--nostrstack-motion-ease-emphasized);
}
.nostrstack-popover-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 0.75rem; }
.nostrstack-popover-title { font-weight: 900; font-size: 1.1rem; letter-spacing: 0.01em; }
.nostrstack-popover-sub { color: var(--nostrstack-color-text-muted); font-weight: 700; font-size: 0.92rem; }
.nostrstack-popover-close { margin-left: auto; }
.nostrstack-popover-grid { display: grid; grid-template-columns: minmax(220px, 260px) 1fr; gap: 1rem; align-items: center; }
.nostrstack-qr {
  padding: 0.6rem;
  background: var(--nostrstack-color-surface-subtle);
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
  box-shadow: var(--nostrstack-shadow-md);
  overflow: hidden;
}
.nostrstack-qr img,
.nostrstack-qr svg,
.nostrstack-qr canvas {
  width: 100%;
  height: auto;
  display: block;
  border-radius: var(--nostrstack-radius-md);
}
.nostrstack-qr canvas { aspect-ratio: 1 / 1; }
.nostrstack-popover-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.75rem; }
.nostrstack-invoice-box {
  margin-top: 0.85rem;
  background: var(--nostrstack-color-surface-subtle);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-md);
  padding: 0.75rem;
  max-height: 140px;
  overflow: auto;
}
.nostrstack-invoice-box .nostrstack-code { font-size: 0.9rem; word-break: break-word; white-space: pre-wrap; }

/* ===== Pay-to-action widget ===== */
.nostrstack-pay {
  padding: var(--nostrstack-space-4);
  display: grid;
  gap: var(--nostrstack-space-3);
}

.nostrstack-pay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nostrstack-space-2);
  flex-wrap: wrap;
}

.nostrstack-pay-status {
  padding: 0.25rem 0.65rem;
  border-radius: var(--nostrstack-radius-pill);
  border: 1px solid var(--nostrstack-color-border);
  background: color-mix(in oklab, var(--nostrstack-color-surface-strong) 55%, transparent);
  box-shadow: var(--nostrstack-shadow-sm);
  font-weight: 900;
}

.nostrstack-pay--unlocked .nostrstack-pay-status {
  border-color: color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border));
  background: color-mix(in oklab, var(--nostrstack-color-success) 10%, var(--nostrstack-color-surface));
}

.nostrstack-pay-panel {
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
  background:
    radial-gradient(1000px circle at top left, color-mix(in oklab, var(--nostrstack-color-primary) 12%, transparent), transparent 58%),
    linear-gradient(180deg,
      color-mix(in oklab, var(--nostrstack-color-surface) 92%, transparent),
      color-mix(in oklab, var(--nostrstack-color-surface-subtle) 92%, transparent));
  padding: var(--nostrstack-space-3);
  box-shadow: var(--nostrstack-shadow-lg);
}

.nostrstack-pay-grid {
  display: grid;
  grid-template-columns: minmax(200px, 240px) 1fr;
  gap: var(--nostrstack-space-3);
  align-items: start;
}

.nostrstack-pay-qr {
  padding: 0.6rem;
  background: var(--nostrstack-color-surface-subtle);
  border-radius: var(--nostrstack-radius-lg);
  border: 1px solid var(--nostrstack-color-border);
  box-shadow: var(--nostrstack-shadow-md);
}
.nostrstack-pay-qr img { width: 100%; height: auto; display: block; border-radius: var(--nostrstack-radius-md); background: white; }

.nostrstack-pay-right {
  display: flex;
  flex-direction: column;
  gap: var(--nostrstack-space-2);
  min-width: 240px;
}

.nostrstack-pay-realtime {
  font-size: 0.85rem;
  font-weight: 750;
  color: var(--nostrstack-color-text-muted);
}

.nostrstack-pay-actions { display: flex; flex-wrap: wrap; gap: var(--nostrstack-space-2); align-items: center; }
.nostrstack-pay .nostrstack-invoice-box { width: 100%; margin-top: 0; max-height: 160px; }

@media (max-width: 640px) {
  .nostrstack-pay-grid { grid-template-columns: 1fr; }
}

/* ===== Comments widget ===== */
.nostrstack-comments {
  padding: var(--nostrstack-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--nostrstack-space-3);
}
.nostrstack-comments-header { display: flex; align-items: center; justify-content: space-between; gap: var(--nostrstack-space-2); }
.nostrstack-comments-title { font-weight: 900; font-size: 1.05rem; letter-spacing: 0.01em; }
.nostrstack-comments-relays { flex: 0 0 auto; }
.nostrstack-comments-list { display: flex; flex-direction: column; gap: var(--nostrstack-space-2); }
.nostrstack-comment {
  padding: var(--nostrstack-space-3);
  border: 1px solid var(--nostrstack-color-border);
  background: color-mix(in oklab, var(--nostrstack-color-surface) 92%, var(--nostrstack-color-primary-soft));
  border-radius: var(--nostrstack-radius-md);
  box-shadow: var(--nostrstack-shadow-sm);
  transition:
    transform var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    box-shadow var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard),
    border-color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard);
  animation: nostrstack-rise var(--nostrstack-motion-enter) var(--nostrstack-motion-ease-emphasized);
}
.nostrstack-comment:hover { transform: translateY(-1px); box-shadow: var(--nostrstack-shadow-md); border-color: var(--nostrstack-color-border-strong); }
.nostrstack-comments-form { display: flex; flex-direction: column; gap: var(--nostrstack-space-2); width: 100%; }
.nostrstack-comments-form .nostrstack-textarea { resize: vertical; min-height: 92px; }

@keyframes nostrstack-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes nostrstack-pop-in {
  from { transform: translateY(var(--nostrstack-motion-distance-mid)) scale(0.98); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes nostrstack-rise {
  from { transform: translateY(var(--nostrstack-motion-distance-short)); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 640px) {
  .nostrstack-popover-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  :where(.nostrstack) * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

export const nostrstackEmbedStyles = `${nostrstackTokensCss}\n${nostrstackComponentsCss}`;
