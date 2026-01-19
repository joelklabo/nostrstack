import { defineConfig, devices } from '@playwright/test';

const defaultPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `https://127.0.0.1:${defaultPort}`;
const defaultWorkers = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : 1;

export default defineConfig({
  testDir: './.playwright',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  workers: defaultWorkers,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: defaultBaseUrl,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    headless: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm dev -- --host --port ${defaultPort}`,
        url: `https://127.0.0.1:${defaultPort}`,
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: '.',
        env: {
          ...process.env,
          VITE_NOSTRSTACK_HOST: process.env.VITE_NOSTRSTACK_HOST ?? 'mock',
          VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? '/api',
          VITE_NOSTRSTACK_RELAYS: 'mock',
          VITE_ENABLE_TEST_SIGNER: process.env.VITE_ENABLE_TEST_SIGNER ?? 'false',
          VITE_ENABLE_PROFILE_PAY: process.env.VITE_ENABLE_PROFILE_PAY ?? 'true',
          VITE_ENABLE_LNURL_AUTH: process.env.VITE_ENABLE_LNURL_AUTH ?? 'true',
          VITE_TEST_SIGNER_SK: process.env.VITE_TEST_SIGNER_SK
        }
      }
});
