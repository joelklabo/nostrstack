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
  /* ==== Color Foundations (OKLCH) ==== */
  /* Using OKLCH for perceptually uniform colors and better gamut */
  
  --nostrstack-chroma: 0.015;
  --nostrstack-hue: 250;

  /* Neutral Scale */
  --nostrstack-neutral-0: oklch(0.995 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-50: oklch(0.985 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-100: oklch(0.97 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-200: oklch(0.92 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-300: oklch(0.87 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-400: oklch(0.7 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-500: oklch(0.55 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-600: oklch(0.4 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-700: oklch(0.25 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-800: oklch(0.15 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-900: oklch(0.1 var(--nostrstack-chroma) var(--nostrstack-hue));
  --nostrstack-neutral-1000: oklch(0.05 var(--nostrstack-chroma) var(--nostrstack-hue));

  /* Brand Scale (Electric Blue) */
  --nostrstack-brand-hue: 250;
  --nostrstack-brand-chroma: 0.25;
  --nostrstack-brand-500: oklch(0.6 var(--nostrstack-brand-chroma) var(--nostrstack-brand-hue));
  --nostrstack-brand-600: oklch(0.5 var(--nostrstack-brand-chroma) var(--nostrstack-brand-hue));
  --nostrstack-brand-400: oklch(0.7 var(--nostrstack-brand-chroma) var(--nostrstack-brand-hue));
  --nostrstack-brand-100: oklch(0.95 0.03 var(--nostrstack-brand-hue));

  /* Semantic Mappings (Light) */
  --nostrstack-color-primary: var(--nostrstack-brand-500);
  --nostrstack-color-primary-strong: var(--nostrstack-brand-600);
  --nostrstack-color-primary-soft: var(--nostrstack-brand-100);
  
  --nostrstack-color-bg: var(--nostrstack-neutral-0);
  --nostrstack-color-surface: #ffffff;
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-50);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-100);
  --nostrstack-color-border: var(--nostrstack-neutral-200);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-300);
  
  --nostrstack-color-text: var(--nostrstack-neutral-900);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-600);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-400);
  --nostrstack-color-text-on-strong: #ffffff;

  --nostrstack-color-success: oklch(0.65 0.2 150);
  --nostrstack-color-warning: oklch(0.75 0.15 70);
  --nostrstack-color-danger: oklch(0.6 0.2 25);
  --nostrstack-color-info: oklch(0.7 0.15 230);
  
  --nostrstack-color-overlay: oklch(0.1 0.02 250 / 0.4);
  --nostrstack-color-ring: oklch(0.6 0.25 250 / 0.3);

  /* Typography */
  --nostrstack-font-body: 'Inter Variable', Inter, system-ui, -apple-system, sans-serif;
  --nostrstack-font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  
  --nostrstack-font-size-xs: 0.75rem;
  --nostrstack-font-size-sm: 0.875rem;
  --nostrstack-font-size-base: 1rem;
  --nostrstack-font-size-lg: 1.125rem;
  --nostrstack-font-size-xl: 1.25rem;
  --nostrstack-font-size-2xl: 1.5rem;

  --nostrstack-font-weight-normal: 400;
  --nostrstack-font-weight-medium: 500;
  --nostrstack-font-weight-semibold: 600;
  --nostrstack-font-weight-bold: 700;
  --nostrstack-font-weight-black: 900;

  /* Spacing */
  --nostrstack-space-1: 0.25rem;
  --nostrstack-space-2: 0.5rem;
  --nostrstack-space-3: 0.75rem;
  --nostrstack-space-4: 1rem;
  --nostrstack-space-5: 1.5rem;
  --nostrstack-space-6: 2rem;
  --nostrstack-space-8: 3rem;
  --nostrstack-space-10: 4rem;
  --nostrstack-space-12: 6rem;

  /* Radii */
  --nostrstack-radius-sm: 0.375rem;
  --nostrstack-radius-md: 0.75rem;
  --nostrstack-radius-lg: 1.25rem;
  --nostrstack-radius-xl: 2rem;
  --nostrstack-radius-pill: 9999px;

  /* Shadows - Layered for realism */
  --nostrstack-shadow-sm: 
    0 1px 2px 0 oklch(0 0 0 / 0.05);
  --nostrstack-shadow-md: 
    0 4px 6px -1px oklch(0 0 0 / 0.1), 
    0 2px 4px -2px oklch(0 0 0 / 0.1);
  --nostrstack-shadow-lg: 
    0 10px 15px -3px oklch(0 0 0 / 0.1), 
    0 4px 6px -4px oklch(0 0 0 / 0.1);
  --nostrstack-shadow-xl: 
    0 20px 25px -5px oklch(0 0 0 / 0.1), 
    0 8px 10px -6px oklch(0 0 0 / 0.1);
  --nostrstack-shadow-premium: 
    0 25px 50px -12px oklch(0 0 0 / 0.25);
  
  --nostrstack-shadow-glow: 0 0 20px -5px var(--nostrstack-color-ring);
  --nostrstack-shadow-focus: 0 0 0 4px var(--nostrstack-color-ring);

  /* Motion */
  --nostrstack-motion-fast: 150ms;
  --nostrstack-motion-base: 250ms;
  --nostrstack-motion-slow: 400ms;
  --nostrstack-motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --nostrstack-motion-ease-emphasized: cubic-bezier(0.25, 0, 0, 1);
}

:where(.nostrstack-theme[data-nostrstack-theme="dark"]) {
  --nostrstack-chroma: 0.03;
  --nostrstack-hue: 250;

  --nostrstack-color-bg: var(--nostrstack-neutral-1000);
  --nostrstack-color-surface: var(--nostrstack-neutral-900);
  --nostrstack-color-surface-subtle: var(--nostrstack-neutral-800);
  --nostrstack-color-surface-strong: var(--nostrstack-neutral-700);
  --nostrstack-color-border: var(--nostrstack-neutral-800);
  --nostrstack-color-border-strong: var(--nostrstack-neutral-700);
  
  --nostrstack-color-text: var(--nostrstack-neutral-50);
  --nostrstack-color-text-muted: var(--nostrstack-neutral-400);
  --nostrstack-color-text-subtle: var(--nostrstack-neutral-500);
  
  --nostrstack-brand-100: oklch(0.2 0.05 var(--nostrstack-brand-hue));
  
  --nostrstack-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.3);
  --nostrstack-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.4);
  --nostrstack-shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.5);
  --nostrstack-shadow-premium: 0 25px 50px -12px oklch(0 0 0 / 0.6);
}
`;

export const nostrstackComponentsCss = `
:where(.nostrstack) {
  color: var(--nostrstack-color-text);
  font-family: var(--nostrstack-font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
}

:where(.nostrstack), :where(.nostrstack *) { box-sizing: border-box; }

/* ===== Interactive Elements ===== */
.nostrstack-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--nostrstack-space-2);
  padding: 0.6rem 1.25rem;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface);
  color: var(--nostrstack-color-text);
  font-weight: var(--nostrstack-font-weight-semibold);
  font-size: var(--nostrstack-font-size-sm);
  cursor: pointer;
  transition: all var(--nostrstack-motion-base) var(--nostrstack-motion-ease-standard);
  box-shadow: var(--nostrstack-shadow-sm);
  user-select: none;
}

.nostrstack-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--nostrstack-shadow-md);
  border-color: var(--nostrstack-color-border-strong);
  background: var(--nostrstack-color-surface-subtle);
}

.nostrstack-btn:active:not(:disabled) { transform: translateY(0); }

.nostrstack-btn--primary {
  background: var(--nostrstack-color-primary);
  border-color: var(--nostrstack-color-primary);
  color: var(--nostrstack-color-text-on-strong);
  box-shadow: 0 4px 14px -2px color-mix(in oklab, var(--nostrstack-color-primary) 40%, transparent);
}

.nostrstack-btn--primary:hover:not(:disabled) {
  background: var(--nostrstack-color-primary-strong);
  border-color: var(--nostrstack-color-primary-strong);
  box-shadow: 0 6px 20px -2px color-mix(in oklab, var(--nostrstack-color-primary) 50%, transparent);
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
}

/* ===== Cards & Containers ===== */
.nostrstack-card {
  background: var(--nostrstack-color-surface);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  box-shadow: var(--nostrstack-shadow-md);
  overflow: hidden;
}

.nostrstack-glass {
  background: color-mix(in oklch, var(--nostrstack-color-surface) 70%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid color-mix(in oklch, var(--nostrstack-color-border) 40%, transparent);
}

/* ===== Typography Utilities ===== */
.nostrstack-title { font-weight: var(--nostrstack-font-weight-black); letter-spacing: -0.02em; color: var(--nostrstack-color-text); }
.nostrstack-muted { color: var(--nostrstack-color-text-muted); font-size: var(--nostrstack-font-size-sm); }

/* ===== Forms ===== */
.nostrstack-input, .nostrstack-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--nostrstack-radius-md);
  border: 1px solid var(--nostrstack-color-border);
  background: var(--nostrstack-color-surface-subtle);
  color: var(--nostrstack-color-text);
  font-size: var(--nostrstack-font-size-base);
  transition: all var(--nostrstack-motion-base);
}
.nostrstack-input:focus, .nostrstack-textarea:focus {
  outline: none;
  border-color: var(--nostrstack-color-primary);
  background: var(--nostrstack-color-surface);
  box-shadow: var(--nostrstack-shadow-focus);
}

/* Specific Widget Overrides for coherence */
.nostrstack-tip__panel {
  border-radius: var(--nostrstack-radius-lg);
  padding: var(--nostrstack-space-5);
  background: var(--nostrstack-color-surface-subtle);
}

.nostrstack-event-card {
  padding: var(--nostrstack-space-5);
  gap: var(--nostrstack-space-4);
  background: var(--nostrstack-color-surface);
  border: 1px solid var(--nostrstack-color-border);
  border-radius: var(--nostrstack-radius-lg);
  transition: all var(--nostrstack-motion-base);
}

.nostrstack-event-card:hover {
  box-shadow: var(--nostrstack-shadow-lg);
  border-color: var(--nostrstack-color-border-strong);
}

/* Animations */
@keyframes nostrstack-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes nostrstack-pop-in { 
  from { opacity: 0; transform: scale(0.96) translateY(10px); } 
  to { opacity: 1; transform: scale(1) translateY(0); } 
}
`;

export const nostrstackEmbedStyles = `${nostrstackTokensCss}\n${nostrstackComponentsCss}`;