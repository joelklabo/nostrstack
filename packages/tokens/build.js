#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable security/detect-non-literal-regexp */

/**
 * NostrStack Design Tokens Build Script
 *
 * Transforms DTCG format tokens into:
 * - CSS custom properties (global and scoped)
 * - JavaScript/TypeScript modules
 * - JSON for tooling
 * - Component CSS classes
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Simple glob pattern matcher for *.tokens.json files
 */
function globSync(pattern) {
  const dir = dirname(pattern);
  const filePattern = basename(pattern);

  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir);

  // Build regex: escape dots first, then replace * with .* matcher
  // Use placeholder to avoid escaping the . in .*
  const regexStr = filePattern
    .replace(/\./g, '\\.') // Escape dots first
    .replace(/\*/g, '.*'); // Then replace * with .*

  const regex = new RegExp('^' + regexStr + '$');

  return files.filter((file) => regex.test(file)).map((file) => join(dir, file));
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure dist directories exist
const distDirs = ['dist/css', 'dist/js', 'dist/json'];
distDirs.forEach((dir) => {
  const fullPath = join(__dirname, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
});

console.log('🎨 Building NostrStack Design Tokens...\n');

/**
 * Load and parse all token files
 */
function loadTokens(patterns) {
  const tokens = {};

  for (const pattern of patterns) {
    const files = globSync(pattern);
    for (const file of files) {
      const content = JSON.parse(readFileSync(file, 'utf-8'));
      deepMerge(tokens, convertDtcgToFlat(content));
    }
  }

  return tokens;
}

/**
 * Sanitize token name for CSS custom property names.
 * CSS custom properties cannot contain dots (e.g., "space-0.5" must become "space-0-5").
 */
function sanitizeForCss(name) {
  return name.replace(/\./g, '-');
}

/**
 * Convert DTCG format to flat token structure
 */
function convertDtcgToFlat(obj, path = [], result = {}) {
  if (obj === null || typeof obj !== 'object') {
    return result;
  }

  for (const [key, val] of Object.entries(obj)) {
    // Skip meta properties
    if (key.startsWith('$')) continue;

    const currentPath = [...path, key];

    // If this is a token (has $value), add it
    if (val && typeof val === 'object' && '$value' in val) {
      const tokenName = currentPath.join('-');
      result[tokenName] = {
        value: val.$value,
        type: val.$type || 'unknown',
        description: val.$description || ''
      };
    } else if (val && typeof val === 'object') {
      // Recurse into nested objects
      convertDtcgToFlat(val, currentPath, result);
    }
  }

  return result;
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Resolve a single reference to a token name.
 * Tries multiple interpretations because dots can be either path separators or part of key names.
 * For example, "{space.2.5}" could mean:
 *   - "space-2.5" (if "2.5" is a single key)
 *   - "space-2-5" (if "2" and "5" are nested keys)
 */
function resolveReference(ref, tokens) {
  // Strategy: try progressively replacing dots from left to right
  // For "space.2.5", try:
  //   1. "space-2.5" (replace only first dot)
  //   2. "space-2-5" (replace all dots)
  const parts = ref.split('.');

  // Try joining parts with hyphens from left to right
  // For ["space", "2", "5"], try: "space-2.5", then "space-2-5"
  for (let i = parts.length - 1; i >= 1; i--) {
    // Join first i parts with hyphen, keep remaining parts joined with dot
    const left = parts.slice(0, i).join('-');
    const right = parts.slice(i).join('.');
    const candidate = right ? `${left}-${right}` : left;

    if (tokens[candidate]) {
      return tokens[candidate].value;
    }
  }

  // Final fallback: replace all dots with hyphens
  const fullReplaced = ref.replace(/\./g, '-');
  if (tokens[fullReplaced]) {
    return tokens[fullReplaced].value;
  }

  return null;
}

/**
 * Resolve token references in values
 */
function resolveReferences(tokens) {
  const maxIterations = 10;
  let iteration = 0;
  let hasUnresolved = true;

  while (hasUnresolved && iteration < maxIterations) {
    hasUnresolved = false;
    iteration++;

    for (const [_name, token] of Object.entries(tokens)) {
      if (typeof token.value === 'string' && token.value.includes('{')) {
        const resolved = token.value.replace(/\{([^}]+)\}/g, (match, ref) => {
          const resolvedValue = resolveReference(ref, tokens);
          if (resolvedValue !== null) {
            return resolvedValue;
          }
          // Reference not found, keep as is
          hasUnresolved = true;
          return match;
        });
        token.value = resolved;
      }
    }
  }

  return tokens;
}

/**
 * Generate CSS from tokens
 */
function generateCSS(tokens, selector = ':root') {
  const lines = Object.entries(tokens)
    .map(([name, token]) => `  --ns-${sanitizeForCss(name)}: ${token.value};`)
    .sort();

  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

/**
 * Generate dark theme CSS
 */
function generateDarkCSS(tokens) {
  const lines = Object.entries(tokens)
    .map(([name, token]) => `  --ns-${sanitizeForCss(name)}: ${token.value};`)
    .sort();

  return `/* Dark theme - System preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${lines.map((l) => '  ' + l).join('\n')}
  }
}

/* Dark theme - Explicit */
[data-theme="dark"],
.ns-theme[data-theme="dark"] {
${lines.join('\n')}
}
`;
}

/**
 * Generate JavaScript module
 */
function generateJS(tokens) {
  // Build nested structure
  const nested = {};
  for (const [name, token] of Object.entries(tokens)) {
    const parts = name.split('-');
    let current = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = token.value;
  }

  return `// Auto-generated by NostrStack Design Tokens
// Do not edit directly

export const tokens = ${JSON.stringify(nested, null, 2)};

export default tokens;
`;
}

/**
 * Generate TypeScript declarations
 */
function generateDTS(tokens) {
  // Build nested structure for types
  const nested = {};
  for (const [name] of Object.entries(tokens)) {
    const parts = name.split('-');
    let current = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = 'string';
  }

  function generateInterface(obj, indent = '') {
    const lines = [];
    for (const [key, val] of Object.entries(obj)) {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
      if (typeof val === 'object') {
        lines.push(`${indent}${safeKey}: {`);
        lines.push(generateInterface(val, indent + '  '));
        lines.push(`${indent}};`);
      } else {
        lines.push(`${indent}${safeKey}: string;`);
      }
    }
    return lines.join('\n');
  }

  return `// Auto-generated by NostrStack Design Tokens
// Do not edit directly

export interface Tokens {
${generateInterface(nested, '  ')}
}

export declare const tokens: Tokens;
export default tokens;
`;
}

/**
 * Generate JSON output
 */
function generateJSON(tokens) {
  const nested = {};
  for (const [name, token] of Object.entries(tokens)) {
    const parts = name.split('-');
    let current = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = {
      value: token.value,
      type: token.type,
      ...(token.description && { description: token.description })
    };
  }
  return JSON.stringify(nested, null, 2);
}

/**
 * Generate flat JSON (CSS variable names to values)
 */
function generateFlatJSON(tokens) {
  const result = {};
  for (const [name, token] of Object.entries(tokens)) {
    result[`--ns-${sanitizeForCss(name)}`] = token.value;
  }
  return JSON.stringify(result, null, 2);
}

// ===== BUILD LIGHT THEME (BASE) =====
console.log('📦 Building base tokens (light theme)...');

const lightTokens = loadTokens([
  join(__dirname, 'src/primitives/*.tokens.json'),
  join(__dirname, 'src/semantic/*.tokens.json'),
  join(__dirname, 'src/components/*.tokens.json')
]);

// Resolve references
const resolvedLightTokens = resolveReferences(lightTokens);

// Generate outputs
const tokensCss = generateCSS(resolvedLightTokens, ':root');
const tokensScopedCss = generateCSS(resolvedLightTokens, ':where(.ns-theme)');
const tokensJs = generateJS(resolvedLightTokens);
const tokensDts = generateDTS(resolvedLightTokens);
const tokensJson = generateJSON(resolvedLightTokens);
const tokensFlatJson = generateFlatJSON(resolvedLightTokens);

writeFileSync(join(__dirname, 'dist/css/tokens.css'), tokensCss);
writeFileSync(join(__dirname, 'dist/css/tokens-scoped.css'), tokensScopedCss);
writeFileSync(join(__dirname, 'dist/js/tokens.js'), tokensJs);
writeFileSync(join(__dirname, 'dist/js/tokens.d.ts'), tokensDts);
writeFileSync(join(__dirname, 'dist/js/tokens.d.cts'), tokensDts);
writeFileSync(join(__dirname, 'dist/json/tokens.json'), tokensJson);
writeFileSync(join(__dirname, 'dist/json/tokens-flat.json'), tokensFlatJson);

// Generate CommonJS version
const cjsContent = tokensJs
  .replace('export const tokens =', 'const tokens =')
  .replace('export default tokens;', 'module.exports = { tokens, default: tokens };');
writeFileSync(join(__dirname, 'dist/js/tokens.cjs'), cjsContent);

// ===== BUILD DARK THEME =====
console.log('🌙 Building dark theme overrides...');

const darkTokens = loadTokens([
  join(__dirname, 'src/primitives/*.tokens.json'),
  join(__dirname, 'src/themes/dark.tokens.json')
]);

const resolvedDarkTokens = resolveReferences(darkTokens);

// Only include tokens that are different from light theme (semantic overrides)
const darkOverrides = {};
for (const [name, token] of Object.entries(resolvedDarkTokens)) {
  // Include color tokens from dark theme
  if (name.startsWith('color-') || name.startsWith('shadow-')) {
    darkOverrides[name] = token;
  }
}

const darkCss = generateDarkCSS(darkOverrides);
writeFileSync(join(__dirname, 'dist/css/theme-dark.css'), darkCss);

// ===== GENERATE COMBINED CSS =====
console.log('📄 Generating combined CSS...');

const combinedCss = `/* NostrStack Design Tokens
 * Auto-generated - Do not edit directly
 *
 * Usage:
 *   @import '@nostrstack/tokens/css';
 *
 * For dark mode, also import:
 *   @import '@nostrstack/tokens/themes/dark';
 *
 * Or use the combined file:
 *   @import '@nostrstack/tokens/css/all';
 */

${tokensCss}
${darkCss}
`;

writeFileSync(join(__dirname, 'dist/css/all.css'), combinedCss);

// ===== GENERATE UTILITIES =====
console.log('🛠️ Generating CSS utilities...');
const utilitiesCss = generateUtilities();
writeFileSync(join(__dirname, 'dist/css/utilities.css'), utilitiesCss);

// ===== GENERATE COMPONENTS =====
console.log('🧩 Generating component CSS...');
const componentsCss = generateComponentCSS();
writeFileSync(join(__dirname, 'dist/css/components.css'), componentsCss);

console.log('\n✅ Build complete!\n');
console.log('Output:');
console.log('  dist/css/tokens.css        - Base CSS variables');
console.log('  dist/css/tokens-scoped.css - Scoped CSS variables');
console.log('  dist/css/theme-dark.css    - Dark theme overrides');
console.log('  dist/css/all.css           - Combined CSS');
console.log('  dist/css/utilities.css     - Utility classes');
console.log('  dist/css/components.css    - Component classes');
console.log('  dist/js/tokens.js          - ESM module');
console.log('  dist/js/tokens.cjs         - CommonJS module');
console.log('  dist/js/tokens.d.ts        - TypeScript declarations');
console.log('  dist/json/tokens.json      - Nested JSON');
console.log('  dist/json/tokens-flat.json - Flat JSON');

/**
 * Generate utility classes from tokens
 */
function generateUtilities() {
  return `/* NostrStack Utility Classes
 * Auto-generated from design tokens
 */

/* Colors */
.ns-text-default { color: var(--ns-color-text-default); }
.ns-text-muted { color: var(--ns-color-text-muted); }
.ns-text-subtle { color: var(--ns-color-text-subtle); }
.ns-text-inverse { color: var(--ns-color-text-inverse); }
.ns-text-primary { color: var(--ns-color-primary-default); }
.ns-text-success { color: var(--ns-color-success-default); }
.ns-text-warning { color: var(--ns-color-warning-default); }
.ns-text-danger { color: var(--ns-color-danger-default); }

.ns-bg-default { background-color: var(--ns-color-bg-default); }
.ns-bg-subtle { background-color: var(--ns-color-bg-subtle); }
.ns-bg-muted { background-color: var(--ns-color-bg-muted); }
.ns-bg-surface { background-color: var(--ns-color-surface-default); }
.ns-bg-primary { background-color: var(--ns-color-primary-default); }
.ns-bg-primary-subtle { background-color: var(--ns-color-primary-subtle); }

/* Spacing */
.ns-p-0 { padding: var(--ns-space-0); }
.ns-p-1 { padding: var(--ns-space-1); }
.ns-p-2 { padding: var(--ns-space-2); }
.ns-p-3 { padding: var(--ns-space-3); }
.ns-p-4 { padding: var(--ns-space-4); }
.ns-p-5 { padding: var(--ns-space-5); }
.ns-p-6 { padding: var(--ns-space-6); }
.ns-p-8 { padding: var(--ns-space-8); }

.ns-m-0 { margin: var(--ns-space-0); }
.ns-m-1 { margin: var(--ns-space-1); }
.ns-m-2 { margin: var(--ns-space-2); }
.ns-m-3 { margin: var(--ns-space-3); }
.ns-m-4 { margin: var(--ns-space-4); }
.ns-m-5 { margin: var(--ns-space-5); }
.ns-m-6 { margin: var(--ns-space-6); }
.ns-m-8 { margin: var(--ns-space-8); }

.ns-gap-1 { gap: var(--ns-space-1); }
.ns-gap-2 { gap: var(--ns-space-2); }
.ns-gap-3 { gap: var(--ns-space-3); }
.ns-gap-4 { gap: var(--ns-space-4); }
.ns-gap-5 { gap: var(--ns-space-5); }
.ns-gap-6 { gap: var(--ns-space-6); }

/* Border Radius */
.ns-rounded-none { border-radius: var(--ns-radius-none); }
.ns-rounded-sm { border-radius: var(--ns-radius-sm); }
.ns-rounded-md { border-radius: var(--ns-radius-md); }
.ns-rounded-lg { border-radius: var(--ns-radius-lg); }
.ns-rounded-xl { border-radius: var(--ns-radius-xl); }
.ns-rounded-2xl { border-radius: var(--ns-radius-2xl); }
.ns-rounded-full { border-radius: var(--ns-radius-full); }

/* Shadows */
.ns-shadow-none { box-shadow: var(--ns-shadow-none); }
.ns-shadow-xs { box-shadow: var(--ns-shadow-xs); }
.ns-shadow-sm { box-shadow: var(--ns-shadow-sm); }
.ns-shadow-md { box-shadow: var(--ns-shadow-md); }
.ns-shadow-lg { box-shadow: var(--ns-shadow-lg); }
.ns-shadow-xl { box-shadow: var(--ns-shadow-xl); }
.ns-shadow-2xl { box-shadow: var(--ns-shadow-2xl); }

/* Typography */
.ns-font-sans { font-family: var(--ns-font-family-sans); }
.ns-font-mono { font-family: var(--ns-font-family-mono); }

.ns-text-2xs { font-size: var(--ns-font-size-2xs); }
.ns-text-xs { font-size: var(--ns-font-size-xs); }
.ns-text-sm { font-size: var(--ns-font-size-sm); }
.ns-text-base { font-size: var(--ns-font-size-base); }
.ns-text-lg { font-size: var(--ns-font-size-lg); }
.ns-text-xl { font-size: var(--ns-font-size-xl); }
.ns-text-2xl { font-size: var(--ns-font-size-2xl); }
.ns-text-3xl { font-size: var(--ns-font-size-3xl); }
.ns-text-4xl { font-size: var(--ns-font-size-4xl); }
.ns-text-5xl { font-size: var(--ns-font-size-5xl); }

.ns-font-normal { font-weight: var(--ns-font-weight-normal); }
.ns-font-medium { font-weight: var(--ns-font-weight-medium); }
.ns-font-semibold { font-weight: var(--ns-font-weight-semibold); }
.ns-font-bold { font-weight: var(--ns-font-weight-bold); }
.ns-font-black { font-weight: var(--ns-font-weight-black); }

/* Focus Ring */
.ns-focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ns-color-focus-ring);
}

/* Screen Reader Only */
.ns-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .ns-motion-safe {
    animation: none !important;
    transition: none !important;
  }
}
`;
}

/**
 * Generate component CSS from tokens
 */
function generateComponentCSS() {
  return `/* NostrStack Component Classes
 * Auto-generated from design tokens
 */

/* Base Theme Setup */
.ns-theme {
  color: var(--ns-color-text-default);
  background-color: var(--ns-color-bg-default);
  font-family: var(--ns-font-family-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
}

.ns-theme *, .ns-theme *::before, .ns-theme *::after {
  box-sizing: border-box;
}

/* ===== BUTTONS ===== */
.ns-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ns-space-2);
  padding: var(--ns-space-2-5, 0.625rem) var(--ns-space-4);
  min-height: 2.5rem;
  border-radius: var(--ns-radius-lg);
  font-size: var(--ns-font-size-sm);
  font-weight: var(--ns-font-weight-semibold);
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  white-space: nowrap;
  transition: var(
    --ns-component-button-transition,
    color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    background-color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    border-color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    box-shadow var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    transform var(--ns-duration-fast, 100ms) var(--ns-easing-easeInOut, ease)
  );

  /* Default variant */
  background: var(--ns-btn-bg, var(--ns-color-surface-default));
  color: var(--ns-btn-text, var(--ns-color-text-default));
  border: 1px solid var(--ns-btn-border, var(--ns-color-border-default));
  box-shadow: var(--ns-btn-shadow, var(--ns-shadow-xs));
}

.ns-btn:hover:not(:disabled) {
  background: var(--ns-btn-bgHover, var(--ns-color-bg-subtle));
  border-color: var(--ns-btn-borderHover, var(--ns-color-border-strong));
  box-shadow: var(--ns-btn-shadowHover, var(--ns-shadow-sm));
  transform: translateY(-1px);
}

.ns-btn:active:not(:disabled) {
  transform: translateY(0);
}

.ns-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ns-color-focus-ring);
}

.ns-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Primary Button */
.ns-btn--primary {
  --ns-btn-bg: var(--ns-color-primary-default);
  --ns-btn-bgHover: var(--ns-color-primary-hover);
  --ns-btn-text: var(--ns-color-primary-text);
  --ns-btn-border: var(--ns-color-primary-default);
  --ns-btn-shadow: 0 4px 14px -3px var(--ns-color-primary-default);
  --ns-btn-shadowHover: 0 6px 20px -3px var(--ns-color-primary-default);
}

/* Ghost Button */
.ns-btn--ghost {
  --ns-btn-bg: transparent;
  --ns-btn-bgHover: var(--ns-color-bg-subtle);
  --ns-btn-text: var(--ns-color-text-muted);
  --ns-btn-border: transparent;
  --ns-btn-shadow: none;
  --ns-btn-shadowHover: none;
}

.ns-btn--ghost:hover:not(:disabled) {
  color: var(--ns-color-text-default);
}

/* Danger Button */
.ns-btn--danger {
  --ns-btn-bg: var(--ns-color-danger-default);
  --ns-btn-bgHover: var(--ns-color-danger-hover);
  --ns-btn-text: white;
  --ns-btn-border: var(--ns-color-danger-default);
}

/* Small Button */
.ns-btn--sm {
  padding: var(--ns-space-1-5, 0.375rem) var(--ns-space-3);
  min-height: 2rem;
  font-size: var(--ns-font-size-xs);
}

/* Large Button */
.ns-btn--lg {
  padding: var(--ns-space-3) var(--ns-space-6);
  min-height: 3rem;
  font-size: var(--ns-font-size-base);
}

/* ===== CARDS ===== */
.ns-card {
  background: var(--ns-card-bg, var(--ns-color-surface-default));
  border: 1px solid var(--ns-card-border, var(--ns-color-border-default));
  border-radius: var(--ns-card-borderRadius, var(--ns-radius-xl));
  box-shadow: var(--ns-card-shadow, var(--ns-shadow-sm));
  transition: var(
    --ns-component-card-transition,
    border-color var(--ns-duration-moderate, 200ms) var(--ns-easing-easeInOut, ease),
    box-shadow var(--ns-duration-moderate, 200ms) var(--ns-easing-easeInOut, ease)
  );
  overflow: hidden;
}

.ns-card:hover {
  border-color: var(--ns-card-borderHover, var(--ns-color-border-strong));
  box-shadow: var(--ns-card-shadowHover, var(--ns-shadow-md));
}

.ns-card__header {
  padding: var(--ns-space-4) var(--ns-space-5);
  border-bottom: 1px solid var(--ns-color-border-subtle);
}

.ns-card__body {
  padding: var(--ns-space-5);
}

.ns-card__footer {
  padding: var(--ns-space-4) var(--ns-space-5);
  border-top: 1px solid var(--ns-color-border-subtle);
  background: var(--ns-color-bg-subtle);
}

/* ===== INPUTS ===== */
.ns-input,
.ns-textarea,
.ns-select {
  width: 100%;
  padding: var(--ns-space-3) var(--ns-space-4);
  min-height: 2.5rem;
  border: 1px solid var(--ns-color-border-default);
  border-radius: var(--ns-radius-lg);
  background: var(--ns-color-surface-default);
  color: var(--ns-color-text-default);
  font-family: inherit;
  font-size: var(--ns-font-size-sm);
  line-height: 1.5;
  transition: var(
    --ns-component-input-transition,
    color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    background-color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    border-color var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease),
    box-shadow var(--ns-duration-normal, 150ms) var(--ns-easing-easeInOut, ease)
  );
}

.ns-input::placeholder,
.ns-textarea::placeholder {
  color: var(--ns-color-text-subtle);
}

.ns-input:hover:not(:disabled),
.ns-textarea:hover:not(:disabled),
.ns-select:hover:not(:disabled) {
  border-color: var(--ns-color-border-strong);
}

.ns-input:focus,
.ns-textarea:focus,
.ns-select:focus {
  outline: none;
  border-color: var(--ns-color-primary-default);
  box-shadow: 0 0 0 3px var(--ns-color-focus-ring);
}

.ns-input:disabled,
.ns-textarea:disabled,
.ns-select:disabled {
  background: var(--ns-color-bg-muted);
  color: var(--ns-color-text-disabled);
  border-color: var(--ns-color-border-subtle);
  cursor: not-allowed;
}

.ns-input--error,
.ns-textarea--error {
  border-color: var(--ns-color-danger-default);
}

.ns-input--error:focus,
.ns-textarea--error:focus {
  box-shadow: 0 0 0 3px var(--ns-color-danger-subtle);
}

.ns-textarea {
  min-height: 5rem;
  resize: vertical;
}

/* ===== ALERTS ===== */
.ns-alert {
  display: flex;
  gap: var(--ns-space-3);
  padding: var(--ns-space-4);
  border-radius: var(--ns-radius-lg);
  border: 1px solid;
  border-left-width: 4px;
}

.ns-alert__icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.ns-alert__content {
  flex: 1;
  min-width: 0;
}

.ns-alert__title {
  font-size: var(--ns-font-size-sm);
  font-weight: var(--ns-font-weight-semibold);
  margin-bottom: var(--ns-space-1);
}

.ns-alert__body {
  font-size: var(--ns-font-size-sm);
}

.ns-alert--info {
  background: var(--ns-color-info-subtle);
  border-color: var(--ns-color-info-muted);
  border-left-color: var(--ns-color-info-default);
  color: var(--ns-color-info-text);
}

.ns-alert--success {
  background: var(--ns-color-success-subtle);
  border-color: var(--ns-color-success-muted);
  border-left-color: var(--ns-color-success-default);
  color: var(--ns-color-success-text);
}

.ns-alert--warning {
  background: var(--ns-color-warning-subtle);
  border-color: var(--ns-color-warning-muted);
  border-left-color: var(--ns-color-warning-default);
  color: var(--ns-color-warning-text);
}

.ns-alert--danger {
  background: var(--ns-color-danger-subtle);
  border-color: var(--ns-color-danger-muted);
  border-left-color: var(--ns-color-danger-default);
  color: var(--ns-color-danger-text);
}

/* ===== BADGES ===== */
.ns-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ns-space-0-5, 0.125rem) var(--ns-space-2);
  font-size: var(--ns-font-size-xs);
  font-weight: var(--ns-font-weight-semibold);
  border-radius: var(--ns-radius-full);
  background: var(--ns-color-bg-muted);
  color: var(--ns-color-text-muted);
}

.ns-badge--primary {
  background: var(--ns-color-primary-subtle);
  color: var(--ns-color-primary-default);
}

.ns-badge--success {
  background: var(--ns-color-success-subtle);
  color: var(--ns-color-success-text);
}

.ns-badge--warning {
  background: var(--ns-color-warning-subtle);
  color: var(--ns-color-warning-text);
}

.ns-badge--danger {
  background: var(--ns-color-danger-subtle);
  color: var(--ns-color-danger-text);
}

/* ===== SKELETON ===== */
.ns-skeleton {
  background: linear-gradient(
    90deg,
    var(--ns-color-bg-muted) 0%,
    var(--ns-color-bg-subtle) 50%,
    var(--ns-color-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: ns-skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--ns-radius-md);
}

.ns-skeleton--text {
  height: 1rem;
  width: 100%;
}

.ns-skeleton--circle {
  border-radius: var(--ns-radius-full);
}

@keyframes ns-skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== SPINNER ===== */
.ns-spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--ns-color-border-default);
  border-top-color: var(--ns-color-primary-default);
  border-radius: var(--ns-radius-full);
  animation: ns-spin 0.75s linear infinite;
}

.ns-spinner--sm {
  width: 1rem;
  height: 1rem;
}

.ns-spinner--lg {
  width: 2rem;
  height: 2rem;
  border-width: 3px;
}

@keyframes ns-spin {
  to { transform: rotate(360deg); }
}

/* ===== MODAL/DIALOG ===== */
.ns-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--ns-color-overlay-default);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ns-space-4);
  z-index: 9999;
  backdrop-filter: blur(4px);
  animation: ns-fade-in var(--ns-duration-normal, 150ms) var(--ns-easing-easeOut, ease-out);
}

.ns-modal {
  width: 100%;
  max-width: 32rem;
  max-height: calc(100vh - var(--ns-space-8));
  background: var(--ns-color-surface-default);
  border: 1px solid var(--ns-color-border-default);
  border-radius: var(--ns-radius-2xl);
  box-shadow: var(--ns-shadow-xl);
  overflow: hidden;
  animation: ns-scale-in var(--ns-duration-moderate, 200ms) var(--ns-easing-emphasized, cubic-bezier(0.25, 0, 0, 1));
}

.ns-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ns-space-4) var(--ns-space-5);
  border-bottom: 1px solid var(--ns-color-border-subtle);
}

.ns-modal__title {
  font-size: var(--ns-font-size-lg);
  font-weight: var(--ns-font-weight-semibold);
  color: var(--ns-color-text-default);
}

.ns-modal__close {
  padding: var(--ns-space-2);
  border: none;
  background: transparent;
  color: var(--ns-color-text-muted);
  cursor: pointer;
  border-radius: var(--ns-radius-md);
  transition:
    color var(--ns-duration-fast, 100ms) var(--ns-easing-easeInOut, ease),
    background-color var(--ns-duration-fast, 100ms) var(--ns-easing-easeInOut, ease);
}

.ns-modal__close:hover {
  background: var(--ns-color-bg-subtle);
  color: var(--ns-color-text-default);
}

.ns-modal__body {
  padding: var(--ns-space-5);
  overflow-y: auto;
}

.ns-modal__footer {
  display: flex;
  gap: var(--ns-space-3);
  justify-content: flex-end;
  padding: var(--ns-space-4) var(--ns-space-5);
  border-top: 1px solid var(--ns-color-border-subtle);
  background: var(--ns-color-bg-subtle);
}

/* ===== ANIMATIONS ===== */
@keyframes ns-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes ns-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes ns-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== TOAST ===== */
.ns-toast-region {
  position: fixed;
  bottom: var(--ns-space-5);
  right: var(--ns-space-5);
  z-index: 10000;
  display: flex;
  flex-direction: column-reverse;
  gap: var(--ns-space-3);
  max-width: 24rem;
  pointer-events: none;
}

.ns-toast {
  display: flex;
  align-items: center;
  gap: var(--ns-space-3);
  padding: var(--ns-space-3) var(--ns-space-4);
  background: var(--ns-color-surface-default);
  border: 1px solid var(--ns-color-border-default);
  border-radius: var(--ns-radius-lg);
  box-shadow: var(--ns-shadow-lg);
  animation: ns-slide-up var(--ns-duration-moderate, 200ms) var(--ns-easing-emphasized, cubic-bezier(0.25, 0, 0, 1));
  pointer-events: auto;
}

.ns-toast__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--ns-radius-full);
  flex-shrink: 0;
}

.ns-toast--info .ns-toast__dot {
  background: var(--ns-color-info-default);
}

.ns-toast--success .ns-toast__dot {
  background: var(--ns-color-success-default);
}

.ns-toast--danger .ns-toast__dot {
  background: var(--ns-color-danger-default);
}

.ns-toast__msg {
  flex: 1;
  font-size: var(--ns-font-size-sm);
  color: var(--ns-color-text-default);
}

.ns-toast__close {
  flex-shrink: 0;
  margin-left: auto;
}

/* ===== REDUCED MOTION ===== */
@media (prefers-reduced-motion: reduce) {
  .ns-btn,
  .ns-card,
  .ns-input,
  .ns-textarea,
  .ns-select,
  .ns-modal-overlay,
  .ns-modal,
  .ns-toast {
    transition: none;
    animation: none;
  }

  .ns-skeleton {
    animation: none;
    background: var(--ns-color-bg-muted);
  }

  .ns-spinner {
    animation-duration: 1.5s;
  }
}
`;
}
