import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    alias: {
      '@satoshis/embed': path.resolve(__dirname, '../../packages/embed/src'),
      '@satoshis/sdk': path.resolve(__dirname, '../../packages/sdk/src')
    }
  }
});
