import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    alias: {
      '@nostrstack/sdk': path.resolve(__dirname, '../sdk/src')
    }
  }
});
