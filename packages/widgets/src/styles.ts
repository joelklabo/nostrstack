/**
 * NostrStack Widget Styles
 * CSS is auto-generated from @nostrstack/tokens - run `pnpm generate:styles` to update
 */

// Import auto-generated CSS from tokens package
export {
  nsComponentsCss,
  nsDarkThemeCss,
  nsEmbedStyles,
  nsTokensCss
} from './generated/tokens-css.js';

export type NsThemeMode = 'light' | 'dark';

export type NsTheme = {
  mode?: NsThemeMode;
  color?: Partial<{
    primary: string;
    primaryHover: string;
    primarySubtle: string;
    accent: string;
    accentSubtle: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    bg: string;
    surface: string;
    bgSubtle: string;
    bgMuted: string;
    overlay: string;
    border: string;
    borderStrong: string;
    focusRing: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    primaryText: string;
  }>;
  radius?: Partial<{
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  }>;
  shadow?: Partial<{
    sm: string;
    md: string;
    lg: string;
    xl: string;
  }>;
  font?: Partial<{
    sans: string;
    mono: string;
  }>;
  motion?: Partial<{
    fast: string;
    normal: string;
    slow: string;
    easeInOut: string;
    emphasized: string;
  }>;
};

const STYLE_ID = 'ns-embed-styles-v3';

function setVar(el: HTMLElement, name: string, value: string | undefined) {
  if (!value) return;
  el.style.setProperty(name, value);
}

export function applyNsTheme(target: HTMLElement, theme: NsTheme = {}) {
  target.classList.add('ns-theme');
  if (theme.mode) {
    target.setAttribute('data-theme', theme.mode);
  }

  const c = theme.color ?? {};
  setVar(target, '--ns-color-primary-default', c.primary);
  setVar(target, '--ns-color-primary-hover', c.primaryHover);
  setVar(target, '--ns-color-primary-subtle', c.primarySubtle);
  setVar(target, '--ns-color-accent-default', c.accent);
  setVar(target, '--ns-color-accent-subtle', c.accentSubtle);
  setVar(target, '--ns-color-success-default', c.success);
  setVar(target, '--ns-color-warning-default', c.warning);
  setVar(target, '--ns-color-danger-default', c.danger);
  setVar(target, '--ns-color-info-default', c.info);
  setVar(target, '--ns-color-bg-default', c.bg);
  setVar(target, '--ns-color-surface-default', c.surface);
  setVar(target, '--ns-color-bg-subtle', c.bgSubtle);
  setVar(target, '--ns-color-bg-muted', c.bgMuted);
  setVar(target, '--ns-color-overlay-default', c.overlay);
  setVar(target, '--ns-color-border-default', c.border);
  setVar(target, '--ns-color-border-strong', c.borderStrong);
  setVar(target, '--ns-color-focus-ring', c.focusRing);
  setVar(target, '--ns-color-text-default', c.text);
  setVar(target, '--ns-color-text-muted', c.textMuted);
  setVar(target, '--ns-color-text-subtle', c.textSubtle);
  setVar(target, '--ns-color-primary-text', c.primaryText);

  const r = theme.radius ?? {};
  setVar(target, '--ns-radius-sm', r.sm);
  setVar(target, '--ns-radius-md', r.md);
  setVar(target, '--ns-radius-lg', r.lg);
  setVar(target, '--ns-radius-xl', r.xl);
  setVar(target, '--ns-radius-full', r.full);

  const s = theme.shadow ?? {};
  setVar(target, '--ns-shadow-sm', s.sm);
  setVar(target, '--ns-shadow-md', s.md);
  setVar(target, '--ns-shadow-lg', s.lg);
  setVar(target, '--ns-shadow-xl', s.xl);

  const f = theme.font ?? {};
  setVar(target, '--ns-font-family-sans', f.sans);
  setVar(target, '--ns-font-family-mono', f.mono);

  const m = theme.motion ?? {};
  setVar(target, '--ns-duration-fast', m.fast);
  setVar(target, '--ns-duration-normal', m.normal);
  setVar(target, '--ns-duration-slow', m.slow);
  setVar(target, '--ns-easing-easeInOut', m.easeInOut);
  setVar(target, '--ns-easing-emphasized', m.emphasized);
}

export function themeToCssVars(theme: NsTheme = {}): Record<string, string> {
  const vars: Record<string, string> = {};

  const add = (name: string, value: string | undefined) => {
    if (!value) return;
    vars[name] = value;
  };

  const c = theme.color ?? {};
  add('--ns-color-primary-default', c.primary);
  add('--ns-color-primary-hover', c.primaryHover);
  add('--ns-color-primary-subtle', c.primarySubtle);
  add('--ns-color-accent-default', c.accent);
  add('--ns-color-accent-subtle', c.accentSubtle);
  add('--ns-color-success-default', c.success);
  add('--ns-color-warning-default', c.warning);
  add('--ns-color-danger-default', c.danger);
  add('--ns-color-info-default', c.info);
  add('--ns-color-bg-default', c.bg);
  add('--ns-color-surface-default', c.surface);
  add('--ns-color-bg-subtle', c.bgSubtle);
  add('--ns-color-bg-muted', c.bgMuted);
  add('--ns-color-overlay-default', c.overlay);
  add('--ns-color-border-default', c.border);
  add('--ns-color-border-strong', c.borderStrong);
  add('--ns-color-focus-ring', c.focusRing);
  add('--ns-color-text-default', c.text);
  add('--ns-color-text-muted', c.textMuted);
  add('--ns-color-text-subtle', c.textSubtle);
  add('--ns-color-primary-text', c.primaryText);

  const r = theme.radius ?? {};
  add('--ns-radius-sm', r.sm);
  add('--ns-radius-md', r.md);
  add('--ns-radius-lg', r.lg);
  add('--ns-radius-xl', r.xl);
  add('--ns-radius-full', r.full);

  const s = theme.shadow ?? {};
  add('--ns-shadow-sm', s.sm);
  add('--ns-shadow-md', s.md);
  add('--ns-shadow-lg', s.lg);
  add('--ns-shadow-xl', s.xl);

  const f = theme.font ?? {};
  add('--ns-font-family-sans', f.sans);
  add('--ns-font-family-mono', f.mono);

  const m = theme.motion ?? {};
  add('--ns-duration-fast', m.fast);
  add('--ns-duration-normal', m.normal);
  add('--ns-duration-slow', m.slow);
  add('--ns-easing-easeInOut', m.easeInOut);
  add('--ns-easing-emphasized', m.emphasized);

  return vars;
}

export function themeToCss(theme: NsTheme = {}, selector = '.ns-theme') {
  const vars = themeToCssVars(theme);
  const entries = Object.entries(vars);
  if (!entries.length) return '';

  const modeSelector = theme.mode ? `[data-theme="${theme.mode}"]` : '';
  const resolvedSelector = `${selector}${modeSelector}`;

  const lines = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  ${name}: ${value};`);
  return `${resolvedSelector} {
${lines.join('\n')}
}
`;
}

// Import the embed styles for injection
import { nsEmbedStyles as generatedEmbedStyles } from './generated/tokens-css.js';

export function ensureNsEmbedStyles(
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined
) {
  if (!doc?.head) return;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = generatedEmbedStyles;
  doc.head.appendChild(style);
}

export function ensureNsRoot(container: HTMLElement, mode?: NsThemeMode) {
  container.classList.add('ns');
  if (mode) {
    container.classList.add('ns-theme');
    container.setAttribute('data-theme', mode);
  } else if (!container.closest?.('.ns-theme')) {
    container.classList.add('ns-theme');
  }
  ensureNsEmbedStyles(container.ownerDocument);
}
