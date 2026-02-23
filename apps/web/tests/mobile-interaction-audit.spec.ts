import { expect, test } from '@playwright/test';

import {
  closePaymentModal,
  dismissOnboardingTourIfOpen,
  dispatchTelemetryWsState,
  loginWithNsec,
  TEST_NSEC
} from './helpers.ts';

type AuditCLSState = {
  total: number;
  shifts: number[];
};

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 393, height: 851 }
];

test.describe('Broader mobile interaction audit', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`mobile action-row and scroll stability on ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      await page.addInitScript(() => {
        (window as Window & { __auditCls?: AuditCLSState }).__auditCls = {
          total: 0,
          shifts: []
        };
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as LayoutShift[]) {
            const state = (window as Window & { __auditCls?: AuditCLSState }).__auditCls;
            if (!state) continue;
            if (entry.hadRecentInput) continue;
            state.total += entry.value;
            state.shifts.push(entry.value);
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      });

      page.setViewportSize(viewport);
      await page.goto('/');
      await loginWithNsec(page, TEST_NSEC);
      await dismissOnboardingTourIfOpen(page);

      const firstActionRow = page
        .locator('[data-testid="web-event-actions"]')
        .locator('.ns-action-btn')
        .first();
      await firstActionRow.waitFor({ state: 'visible', timeout: 12000 });

      const clsStart = await page.evaluate(() => {
        return (window as Window & { __auditCls?: AuditCLSState }).__auditCls?.total ?? 0;
      });
      const feed = page.locator('.feed-container');

      for (let i = 0; i < 4; i++) {
        await page
          .locator('[data-testid="web-event-actions"] .ns-action-btn:visible')
          .first()
          .evaluate((el) => {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          });

        const firstAction = page
          .locator('[data-testid="web-event-actions"] .ns-action-btn:visible')
          .first();
        await expect(firstAction).toBeVisible();
        await firstAction.click({ force: true, timeout: 1000, trial: true });
        await feed.evaluate((element) => {
          element.scrollTo({ top: element.scrollTop + 260, behavior: 'auto' });
        });
        await page.waitForTimeout(180);
      }

      await page.mouse.move(160, 520);
      const clsEnd = await page.evaluate(() => {
        return (window as Window & { __auditCls?: AuditCLSState }).__auditCls?.total ?? 0;
      });
      expect(clsEnd - clsStart).toBeLessThan(0.2);
    });
  }

  test('desktop telemetry rail remains interactive when app enters immersive scroll', async ({
    page
  }) => {
    page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await loginWithNsec(page, TEST_NSEC);
    await dismissOnboardingTourIfOpen(page);

    const telemetrySidebar = page.locator('.telemetry-sidebar');
    const feedContainer = page.locator('.feed-container');
    const retryButton = telemetrySidebar.locator('.ns-conn-retry');

    await expect(telemetrySidebar).toBeVisible({ timeout: 10000 });
    await dispatchTelemetryWsState(page, {
      status: 'offline',
      attempt: 1,
      offlineReason: 'QA audit pre-scroll'
    });

    await expect(retryButton).toBeVisible({ timeout: 5000 });
    const retryButtonPointerEvents = await retryButton.evaluate((element) => {
      return window.getComputedStyle(element).pointerEvents;
    });
    expect(retryButtonPointerEvents).not.toBe('none');
    await retryButton.scrollIntoViewIfNeeded();
    await retryButton.click({ force: true, timeout: 1000, trial: true });

    await dispatchTelemetryWsState(page, {
      status: 'offline',
      attempt: 2,
      offlineReason: 'QA audit'
    });

    await feedContainer.evaluate((element) => {
      element.scrollTo({ top: 360, behavior: 'auto' });
    });
    await expect(telemetrySidebar).toBeVisible();
    await expect(telemetrySidebar).toHaveCSS('pointer-events', 'auto');

    await dispatchTelemetryWsState(page, {
      status: 'reconnecting',
      attempt: 3,
      offlineReason: 'QA audit reconnect'
    });
    await dispatchTelemetryWsState(page, {
      status: 'connected',
      attempt: 4,
      offlineReason: 'QA audit connected'
    });

    if (await retryButton.isVisible().catch(() => false)) {
      await expect(retryButton).toHaveCSS('pointer-events', 'auto');
      await retryButton.click({ force: true, timeout: 1000, trial: true });
    }

    const paymentSelector =
      '.payment-modal, .paywall-payment-modal, .zap-modal, .support-card-modal, .paywall-widget-host';
    const modal = page.locator(paymentSelector).first();
    await closePaymentModal(page, modal).catch(() => undefined);
  });
});
