import { defineConfig } from 'vitest/config';

import { getVitestCacheDir, getVitestCoverageDir } from '../../scripts/vitest-cache';

const cacheDir = getVitestCacheDir('react');
const coverageDir = getVitestCoverageDir('react');

export default defineConfig({
  cacheDir,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
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
