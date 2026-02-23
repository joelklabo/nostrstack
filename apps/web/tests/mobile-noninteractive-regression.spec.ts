import { expect, type Page, test } from '@playwright/test';

import {
  closePaymentModal,
  dismissOnboardingTourIfOpen,
  dispatchTelemetryWsState,
  ensureZapPostAvailable,
  loginWithNsec
} from './helpers.ts';

const mobileViewport = { width: 390, height: 844 };

test.describe('Mobile non-interactive regression sweep', () => {
  const closeKnownPaymentOverlays = async (page: Page) => {
    const paymentModal = page
      .locator(
        '.payment-modal, .paywall-payment-modal, .zap-modal, .support-card-modal, .paywall-widget-host'
      )
      .first();
    await closePaymentModal(page, paymentModal).catch(() => undefined);
  };

  test('feed card action buttons remain hittable during scroll', async ({ page }) => {
    page.setViewportSize(mobileViewport);
    await loginWithNsec(page);
    await dismissOnboardingTourIfOpen(page);
    await ensureZapPostAvailable(page, { fallbackText: 'Mobile interaction seed post' });

    const feedContainer = page.locator('.feed-container');

    for (let batch = 0; batch < 3; batch++) {
      await closeKnownPaymentOverlays(page);
      const post = page.locator('[data-testid="web-event-card"]:visible').first();
      await expect(post).toBeVisible({ timeout: 12000 });

      const actionButtons = post.locator(
        '[data-testid="web-event-actions"] .ns-action-btn:visible'
      );
      const actionCount = await actionButtons.count();
      expect(actionCount).toBeGreaterThan(0);
      const targetCount = Math.min(actionCount, 8);

      for (let i = 0; i < targetCount; i++) {
        await closeKnownPaymentOverlays(page);
        const action = actionButtons.nth(i);
        await expect(action, `action ${i}`).toBeVisible({ timeout: 4000 });
        await action.evaluate((node) => {
          node.scrollIntoView({
            block: 'center',
            inline: 'center',
            behavior: 'instant' as ScrollBehavior
          });
        });

        if (!(await action.isEnabled().catch(() => false))) continue;
        const box = await action.boundingBox();
        expect(box, `action ${i} should have layout box`).toBeTruthy();
        expect(box!.width).toBeGreaterThan(24);
        if (await action.getAttribute('class').then((value) => value?.includes('ns-action-btn'))) {
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        } else {
          expect(box!.height).toBeGreaterThan(20);
          expect(box!.width).toBeGreaterThan(20);
        }

        const pointerEvents = await action.evaluate(
          (node) => window.getComputedStyle(node).pointerEvents
        );
        expect(pointerEvents).not.toBe('none');

        await action.click({ force: true, timeout: 1000, trial: true });
      }

      await feedContainer.evaluate((element) => {
        element.scrollTo({ top: element.scrollTop + 280, behavior: 'auto' });
      });
      await page.waitForTimeout(220);
    }
  });

  test('right rail controls are not blocked by overlay state', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 900 });
    await loginWithNsec(page);
    await dismissOnboardingTourIfOpen(page);

    await expect(page.locator('.telemetry-sidebar')).toBeVisible({ timeout: 10000 });
    await dispatchTelemetryWsState(page, {
      status: 'offline',
      attempt: 3,
      offlineReason: 'QA overlay check'
    });

    const retryButton = page.locator('.telemetry-sidebar .ns-conn-retry');
    await expect(retryButton).toBeVisible({ timeout: 8000 });
    await expect(retryButton).toBeEnabled();
    const pointerEvents = await retryButton.evaluate(
      (element) => window.getComputedStyle(element).pointerEvents
    );
    expect(pointerEvents).not.toBe('none');
    await retryButton.click({ force: true, timeout: 1000, trial: true });

    const telemetryButtons = page.locator('.telemetry-sidebar button:visible');
    await expect(telemetryButtons.first()).toBeVisible({ timeout: 6000 });
    const telemetryButtonCount = await telemetryButtons.count();
    for (let i = 0; i < Math.min(telemetryButtonCount, 8); i++) {
      const button = telemetryButtons.nth(i);
      await button.scrollIntoViewIfNeeded();
      await button.click({ force: true, timeout: 1000, trial: true });
    }
  });
});
