import path from 'node:path';

import { defineConfig } from 'vitest/config';

import { getVitestCacheDir, getVitestCoverageDir } from '../../scripts/vitest-cache';

const cacheDir = getVitestCacheDir('widgets');
const coverageDir = getVitestCoverageDir('widgets');

export default defineConfig({
  cacheDir,
  test: {
    environment: 'jsdom',
    alias: {
      '@nostrstack/sdk': path.resolve(__dirname, '../sdk/src')
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: coverageDir,
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/*.test.tsx', '**/*.test.ts', '**/dist/**'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    }
  }
});
