import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: process.env.GALLERY_BASE_URL || 'https://localhost:4173',
    ignoreHTTPSErrors: true,
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
    url: 'https://localhost:4173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: '.',
    env: {
      ...process.env,
      VITE_NOSTRSTACK_HOST: process.env.VITE_NOSTRSTACK_HOST ?? 'mock',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? 'mock',
      VITE_NOSTRSTACK_RELAYS: process.env.VITE_NOSTRSTACK_RELAYS ?? 'mock',
      VITE_ENABLE_TEST_SIGNER: process.env.VITE_ENABLE_TEST_SIGNER ?? 'false',
      VITE_TEST_SIGNER_SK: process.env.VITE_TEST_SIGNER_SK
    }
  }
});
