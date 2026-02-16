import { defineConfig } from 'vitest/config';

import { getVitestCacheDir, getVitestCoverageDir } from '../../scripts/vitest-cache';

const cacheDir = getVitestCacheDir('ui');
const coverageDir = getVitestCoverageDir('ui');

export default defineConfig({
  cacheDir,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: coverageDir,
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/*.test.tsx', '**/*.test.ts', '**/dist/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});
