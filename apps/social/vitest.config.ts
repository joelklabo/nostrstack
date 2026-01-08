import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
    exclude: ['tests/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@nostrstack/widgets': path.resolve(dirname, '../../packages/widgets/src'),
      '@nostrstack/sdk': path.resolve(dirname, '../../packages/sdk/src')
    }
  }
});
