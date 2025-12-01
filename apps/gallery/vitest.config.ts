import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
