import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'docs', 'screenshots', 'bitcoin-network-status');

const baseStatus = {
  network: 'regtest',
  configuredNetwork: 'regtest',
  source: 'mock',
  telemetry: {
    network: 'regtest',
    height: 101,
    hash: '0'.repeat(64),
    time: 1_700_000_000,
    mempoolTxs: 0,
    mempoolBytes: 0,
    verificationProgress: 1,
    initialBlockDownload: false
  },
  lightning: {
    provider: 'mock',
    lnbits: { status: 'skipped', reason: 'provider_not_lnbits' }
  }
};

const mockStatus = async (page: Page, payload: unknown) => {
  await page.route('**/api/bitcoin/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });
};

const setDevNetwork = async (page: Page, network: string) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('nostrstack.dev.network', value);
    window.localStorage.setItem('nostrstack.guest', 'true');
  }, network);
};

test.describe('Bitcoin network status', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('shows regtest status and captures screenshot', async ({ page }) => {
    await setDevNetwork(page, 'regtest');
    await mockStatus(page, baseStatus);

    await page.goto('/demo');
    await expect(page.locator('.ns-node-card')).toBeVisible();
    await expect(page.locator('.sidebar-network-badge').first()).toHaveText('REGTEST');
    await expect(page.getByText('SOURCE: MOCK')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'regtest-status.png'),
      fullPage: true
    });
  });

  test('shows mutinynet status and captures screenshot', async ({ page }) => {
    await setDevNetwork(page, 'mutinynet');
    await mockStatus(page, {
      ...baseStatus,
      network: 'mutinynet',
      configuredNetwork: 'mutinynet',
      source: 'esplora',
      telemetry: {
        ...baseStatus.telemetry,
        network: 'mutinynet',
        height: 555
      }
    });

    await page.goto('/demo');
    await expect(page.locator('.ns-node-card')).toBeVisible();
    await expect(page.locator('.sidebar-network-badge').first()).toHaveText('MUTINYNET');
    await expect(page.getByText('SOURCE: ESPLORA')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mutinynet-status.png'),
      fullPage: true
    });
  });

  test('shows mainnet warning and captures screenshot', async ({ page }) => {
    await setDevNetwork(page, 'mainnet');
    await mockStatus(page, {
      ...baseStatus,
      network: 'mainnet',
      configuredNetwork: 'mainnet',
      source: 'esplora',
      telemetry: {
        ...baseStatus.telemetry,
        network: 'mainnet',
        height: 888_000
      }
    });

    await page.goto('/demo');
    await expect(page.locator('.ns-node-card')).toBeVisible();
    await expect(page.locator('.sidebar-network-badge').first()).toHaveText('MAINNET');
    await expect(page.getByText('Mainnet active')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mainnet-warning.png'),
      fullPage: true
    });
  });

  test('renders status error callout without crashing', async ({ page }) => {
    await setDevNetwork(page, 'regtest');
    await page.route('**/api/bitcoin/status', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'text/plain',
        body: 'status unavailable'
      });
    });

    await page.goto('/demo');
    await expect(page.getByText('Bitcoin status unavailable', { exact: true })).toBeVisible();
  });
});
