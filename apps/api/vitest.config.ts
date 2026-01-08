import { defineConfig } from 'vitest/config';

process.env.PRISMA_HIDE_UPDATE_MESSAGE ??= '1';
process.env.USE_HTTPS ??= 'false';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/**', 'playwright.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/tests/**', '**/*.test.ts', '**/dist/**', '**/prisma/**'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    }
  },
  server: {
    deps: {
      inline: ['zod']
    }
  }
});
