import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { getVitestCacheDir, getVitestCoverageDir } from '../../scripts/vitest-cache';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const cacheDir = getVitestCacheDir('web');
const coverageDir = getVitestCoverageDir('web');

export default defineConfig({
  cacheDir,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
    exclude: ['tests/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@nostrstack/widgets': path.resolve(dirname, '../../packages/widgets/src'),
      '@nostrstack/sdk': path.resolve(dirname, '../../packages/sdk/src')
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: coverageDir,
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/*.test.tsx',
        '**/*.test.ts',
        '**/dist/**',
        '**/stories/**'
      ],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30
      }
    }
  }
});
