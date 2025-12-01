import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: process.env.GALLERY_BASE_URL || 'http://localhost:4173'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'pnpm preview --host --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
