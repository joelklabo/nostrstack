import { expect, test } from '@playwright/test';

import { dispatchTelemetryWsState, resolveDocScreenshotPath, setBrowserOffline } from './helpers';

const TEST_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
const now = Math.floor(Date.now() / 1000);

const mockStatus = {
  network: 'regtest',
  configuredNetwork: 'regtest',
  source: 'mock',
  telemetry: {
    height: 222_000,
    hash: '0'.repeat(64),
    time: now,
    mempoolTxs: 12,
    mempoolBytes: 1024 * 512,
    subversion: '/Satoshi:24.0.0/',
    connections: 8,
    headers: 222_010,
    blocks: 222_000,
    verificationProgress: 0.98,
    initialBlockDownload: false
  },
  lightning: {
    provider: 'lnbits',
    lnbits: {
      status: 'ok',
      httpStatus: 200,
      elapsedMs: 32,
      body: 'ok',
      urlTried: 'http://localhost:3001'
    }
  }
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((nsec) => {
    localStorage.setItem('nostrstack.auth.mode', 'nsec');
    localStorage.setItem('nostrstack.auth.nsec', nsec);
  }, TEST_NSEC);

  await page.addInitScript(() => {
    window.__NOSTRSTACK_TELEMETRY_TIMING__ = {
      wsBaseDelayMs: 100,
      wsMaxDelayMs: 200,
      wsMaxAttempts: 3,
      wsJitter: 0,
      offlinePollBaseMs: 20,
      offlinePollMaxMs: 20,
      offlinePollJitter: 0
    };
  });
});

test('telemetry reconnect and offline fallback states', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/status of 500/i.test(text)) return;
    // Offline simulation closes wallet WS; ignore the expected disconnect error.
    if (/ws\/wallet/i.test(text) && /ERR_INTERNET_DISCONNECTED/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  let failStatus = false;
  await page.route('**/api/bitcoin/status', async (route) => {
    if (failStatus) {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'status offline' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStatus) });
  });

  await page.goto('/');

  const statusRow = page.locator('.telemetry-status-row');
  await expect(statusRow).toHaveAttribute('role', 'status');
  await expect(statusRow).toHaveAttribute('aria-live', 'polite');

  const statusBadge = page.locator('.telemetry-status');
  await expect(statusBadge).toHaveAttribute('data-status', 'connected', { timeout: 10000 });
  await expect(statusBadge).toContainText('Connected');
  await expect(page.locator('.telemetry-status-time')).not.toContainText('No updates yet');
  await dispatchTelemetryWsState(page, { status: 'reconnecting', attempt: 1, offlineReason: null });
  await expect(statusBadge).toHaveAttribute('data-status', 'reconnecting');
  await expect(statusBadge).toContainText('Reconnecting');

  await page.screenshot({ path: resolveDocScreenshotPath('telemetry-reconnect/telemetry-reconnect.png') });

  failStatus = true;

  await setBrowserOffline(page);

  await expect(statusBadge).toHaveAttribute('data-status', 'offline');
  await expect(page.locator('.telemetry-status-note')).toContainText('Offline reason');
  await expect(page.locator('.telemetry-status-note')).toContainText('Browser offline');
  await expect(page.locator('.telemetry-status-stale')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: resolveDocScreenshotPath('telemetry-reconnect/telemetry-offline.png') });

  expect(consoleErrors).toEqual([]);
});
