import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';

import {
  clickAndExpectPaymentModal,
  closePaymentModal,
  dismissOnboardingTourIfOpen,
  loginWithNsec,
  resolveDocScreenshotPath
} from './helpers.ts';
import { mockLnurlPay } from './helpers/lnurl-mocks';
import { installMockRelay } from './helpers/mock-websocket.ts';

const viewports = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 393, height: 851 }
];

const PAYMENT_MODAL_SELECTOR =
  '.payment-modal, .paywall-payment-modal, .zap-modal, .support-card-modal, .paywall-widget-host';

test.describe('Broader mobile interaction audit', () => {
  for (const viewport of viewports) {
    test(`menu/tap layer audit on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      page.setViewportSize(viewport);
      await page.goto('/');
      await loginWithNsec(page);
      await dismissOnboardingTourIfOpen(page);

      const feed = page.locator('.feed-container');
      await expect(feed, 'Feed should be interactive after login').toBeVisible({ timeout: 10000 });

      const hamburger = page.locator('.hamburger-btn');
      await expect(hamburger, 'Hamburger should be visible on small viewport').toBeVisible({
        timeout: 5000
      });
      await hamburger.click();

      const overlay = page.locator('.sidebar-overlay');
      await expect(overlay, 'Mobile overlay should appear').toHaveClass(/is-visible/, {
        timeout: 3000
      });
      await expect(
        page.locator('.sidebar-overlay').first(),
        'Overlay should block background interaction when menu is open'
      ).toHaveCSS('pointer-events', 'auto');

      const nav = page.locator('.sidebar-nav');
      await expect(nav, 'Sidebar drawer should open').toBeVisible({ timeout: 2000 });
      await expect(nav, 'Sidebar should open state').toHaveClass(/is-open/, { timeout: 2000 });

      const profileNav = page.getByRole('button', { name: 'Profile' }).first();
      await profileNav.click({ timeout: 5000 });
      await page.waitForTimeout(200);
      await expect(page.locator('.profile-view')).toBeVisible({ timeout: 10000 });

      await expect(overlay, 'Overlay should close when navigation occurs').not.toHaveClass(
        /is-visible/,
        {
          timeout: 3000
        }
      );
      await expect(nav, 'Sidebar should close after navigation').not.toHaveClass(/is-open/, {
        timeout: 3000
      });
      await expect(hamburger, 'Menu should remain open-close-capable after navigation').toBeVisible(
        {
          timeout: 2000
        }
      );
      await hamburger.click();
      await expect(overlay, 'Overlay should appear when menu is opened again').toHaveClass(
        /is-visible/,
        {
          timeout: 3000
        }
      );
      await expect(nav).toHaveClass(/is-open/, { timeout: 2000 });
      await overlay.click({ force: true });
      await expect(overlay, 'Overlay should hide after background tap').not.toHaveClass(
        /is-visible/,
        {
          timeout: 3000
        }
      );
      await expect(nav, 'Sidebar should remain closed after backdrop tap').not.toHaveClass(
        /is-open/,
        {
          timeout: 3000
        }
      );

      await page.screenshot({
        path: resolveDocScreenshotPath(`mobile-audit-${viewport.width}x${viewport.height}.png`)
      });
    });

    test(`onboarding remains interactive when mobile menu is open on ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.removeItem('nostrstack.onboarding.v1');
      });

      await page.goto('/');
      await loginWithNsec(page);
      const onboardingCard = page.locator('.onboarding-card');
      await expect(
        onboardingCard,
        'Onboarding should appear before test can validate menu behavior'
      ).toBeVisible({ timeout: 14000 });

      const hamburger = page.locator('.hamburger-btn');
      await expect(hamburger, 'Hamburger should be visible').toBeVisible();
      await hamburger.click();

      const overlay = page.locator('.sidebar-overlay');
      await expect(overlay).toHaveClass(/is-visible/, { timeout: 4000 });
      const dismissButton = page.locator('.onboarding-dismiss');
      await expect(
        dismissButton,
        'Onboarding dismiss button should stay clickable during menu open'
      ).toBeVisible();
      const pointerEvents = await dismissButton.evaluate(
        (node) => window.getComputedStyle(node).pointerEvents
      );
      expect(pointerEvents).not.toBe('none');

      await dismissButton.click();
      await expect(onboardingCard, 'Onboarding should close after dismiss').toBeHidden({
        timeout: 8000
      });
      await expect(overlay).toHaveClass(/is-visible/, { timeout: 2000 });
      const overlayRect = await overlay.boundingBox();
      expect(overlayRect, 'Sidebar overlay should expose a clickable tap region').toBeTruthy();
      await page.mouse.click(
        Math.floor(overlayRect!.x + overlayRect!.width - 32),
        Math.floor(overlayRect!.y + 32)
      );
      await expect(overlay, 'Overlay should hide after backdrop tap').not.toHaveClass(
        /is-visible/,
        { timeout: 3000 }
      );
      await expect(page.locator('.sidebar-nav').first()).not.toHaveClass(/is-open/, {
        timeout: 5000
      });
    });

    test(`payment modal close audit on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      page.setViewportSize(viewport);

      const secretKey = generateSecretKey();
      const now = Math.floor(Date.now() / 1000);
      const profileEvent = finalizeEvent(
        {
          kind: 0,
          created_at: now,
          tags: [],
          content: JSON.stringify({
            name: 'Broader Mobile Friend',
            lud16: 'mobile-audit@example.com'
          })
        },
        secretKey
      );
      const post = finalizeEvent(
        {
          kind: 1,
          created_at: now - 1,
          tags: [],
          content: `Broader mobile audit post ${viewport.width}x${viewport.height}`
        },
        secretKey
      );

      await installMockRelay(page, [profileEvent, post], {
        zapAddress: 'https://mock.lnurl/lnurlp/test'
      });
      await mockLnurlPay(page, {
        callback: 'https://localhost:4173/mock-lnurl-callback',
        metadataText: `Broader mobile audit ${viewport.width}x${viewport.height}`
      });

      await page.goto('/');
      await loginWithNsec(page);
      await dismissOnboardingTourIfOpen(page);

      const zapButtons = page.locator('.zap-btn');
      await expect(zapButtons.first(), 'Need zap button').toBeVisible({ timeout: 8000 });
      await clickAndExpectPaymentModal(page, zapButtons.first(), {
        modalSelector: PAYMENT_MODAL_SELECTOR,
        timeout: 12_000,
        force: true
      });

      const modal = page.locator(PAYMENT_MODAL_SELECTOR).first();
      await expect(modal, 'Payment modal should appear').toBeVisible({ timeout: 10_000 });
      await closePaymentModal(page, modal);

      await expect(page.locator('.feed-container')).toBeVisible({ timeout: 2000 });
    });

    test(`scroll stability audit on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      page.setViewportSize(viewport);
      await page.goto('/');
      await loginWithNsec(page);
      await dismissOnboardingTourIfOpen(page);

      const feed = page.locator('.feed-container');
      await expect(feed, 'Feed list visible').toBeVisible({ timeout: 10000 });

      const layoutShift = await page.evaluate(() => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries() as LayoutShift[];
          for (const entry of entries) {
            if (!entry.hadRecentInput) {
              total += entry.value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            observer.disconnect();
            resolve(total);
          }, 500);
        });
      });

      const firstRow = await feed.locator('.virtualized-row').first().boundingBox();
      expect(firstRow).toBeTruthy();
      const readVisibleRowHeights = async () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('.virtualized-row'), (row) => ({
            key: row.getAttribute('data-virtualized-item') || '',
            height: row.getBoundingClientRect().height
          }))
        );
      const heightsBefore = await readVisibleRowHeights();
      const scrollStateBefore = await feed.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight
      }));
      let totalShift = 0;
      for (let i = 0; i < 5; i++) {
        const step = await feed.evaluate((element) => {
          const before = element.scrollTop;
          element.scrollTop = before + 360;
          return element.scrollTop - before;
        });
        await page.waitForTimeout(220);
        totalShift += Math.abs(step);
      }
      await page.waitForTimeout(200);
      const afterRow = await feed.locator('.virtualized-row').first().boundingBox();
      expect(afterRow).toBeTruthy();
      const heightsAfter = await readVisibleRowHeights();
      const byKeyBefore = new Map(heightsBefore.map((entry) => [entry.key, entry.height]));
      const changedHeights = heightsAfter.filter(
        (entry) => entry.key && Math.abs(entry.height - (byKeyBefore.get(entry.key) || 0)) > 2
      );
      expect(changedHeights.length).toBeLessThanOrEqual(8);
      const scrollStateAfter = await feed.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight
      }));
      expect(scrollStateAfter.scrollTop).toBeGreaterThan(scrollStateBefore.scrollTop);
      expect(totalShift).toBeGreaterThan(0);
      expect(scrollStateAfter.scrollHeight).toBeGreaterThanOrEqual(
        scrollStateBefore.scrollHeight - 100
      );
      const finalShift = await page.evaluate(() => {
        let total = 0;
        const entries = performance.getEntriesByType('layout-shift') as LayoutShift[];
        for (const entry of entries) {
          if (!entry.hadRecentInput) {
            total += entry.value;
          }
        }
        return total;
      });
      expect(finalShift).toBeLessThanOrEqual(layoutShift + 0.2);
    });
  }
});
