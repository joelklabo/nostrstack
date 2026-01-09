#!/usr/bin/env node
/* eslint-env node */
/**
 * Generate inline style strings from @nostrstack/tokens
 * This ensures widgets and tokens stay in sync
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensDir = join(__dirname, '../../tokens/dist/css');
const outputFile = join(__dirname, '../src/generated/tokens-css.ts');

// Ensure output directory exists
const outputDir = dirname(outputFile);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Read CSS files from tokens package
const tokensCss = readFileSync(join(tokensDir, 'tokens-scoped.css'), 'utf-8');
const componentsCss = readFileSync(join(tokensDir, 'components.css'), 'utf-8');
const darkThemeCss = readFileSync(join(tokensDir, 'theme-dark.css'), 'utf-8');

// Generate TypeScript file
const output = `/**
 * Auto-generated from @nostrstack/tokens
 * Do not edit directly - run 'pnpm generate:styles' to regenerate
 */

export const nsTokensCss = ${JSON.stringify(tokensCss)};

export const nsComponentsCss = ${JSON.stringify(componentsCss)};

export const nsDarkThemeCss = ${JSON.stringify(darkThemeCss)};

export const nsEmbedStyles = \`\${nsTokensCss}\\n\${nsComponentsCss}\\n\${nsDarkThemeCss}\`;
`;

writeFileSync(outputFile, output, 'utf-8');
console.log(`Generated ${outputFile}`);
