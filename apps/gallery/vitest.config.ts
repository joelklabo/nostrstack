import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.tsx'],
    exclude: ['tests/**', '**/node_modules/**'],
    alias: {
      '@nostrstack/embed': path.resolve(__dirname, '../../packages/embed/src'),
      '@nostrstack/sdk': path.resolve(__dirname, '../../packages/sdk/src')
    }
  }
});
