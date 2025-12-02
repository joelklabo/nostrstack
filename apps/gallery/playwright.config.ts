import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: process.env.GALLERY_BASE_URL || 'http://localhost:4173',
    launchOptions: {
      args: process.env.CHROMIUM_USER_DATA_DIR
        ? [`--user-data-dir=${process.env.CHROMIUM_USER_DATA_DIR}`]
        : undefined
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'pnpm dev -- --host --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: './apps/gallery',
    env: {
      ...process.env,
      VITE_NOSTRSTACK_HOST: process.env.VITE_NOSTRSTACK_HOST ?? 'mock',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? 'mock',
      VITE_NOSTRSTACK_RELAYS: process.env.VITE_NOSTRSTACK_RELAYS ?? 'mock'
    }
  }
});
