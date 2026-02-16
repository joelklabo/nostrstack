import { defineConfig } from 'vitest/config';

import { getVitestCacheDir, getVitestCoverageDir } from '../../scripts/vitest-cache';

process.env.PRISMA_HIDE_UPDATE_MESSAGE ??= '1';
process.env.USE_HTTPS ??= 'false';

const cacheDir = getVitestCacheDir('api');
const coverageDir = getVitestCoverageDir('api');

export default defineConfig({
  cacheDir,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/**', 'playwright.config.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reportsDirectory: coverageDir,
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/tests/**', '**/*.test.ts', '**/dist/**', '**/prisma/**'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    },
    server: {
      deps: {
        inline: ['zod']
      }
    }
  }
});
