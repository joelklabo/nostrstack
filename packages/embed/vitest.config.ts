import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    alias: {
      '@nostrstack/sdk': path.resolve(__dirname, '../sdk/src')
    }
  }
});
