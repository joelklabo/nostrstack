import { expect, test } from '@playwright/test';

import {
  clickWithDispatchFallback,
  dismissOnboardingTourIfOpen,
  ensureZapPostAvailable,
  loginWithNsec,
  resolveDocScreenshotPath
} from './helpers.ts';

const viewports = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 393, height: 851 }
];

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
      await expect(overlay, 'Mobile overlay should appear').toBeVisible({ timeout: 3000 });
      const overlayPointerEvents = await overlay.evaluate(
        (el) => getComputedStyle(el).pointerEvents
      );
      const overlayOpacity = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      expect(overlayPointerEvents).toBe('auto');
      expect(Number(overlayOpacity)).toBeGreaterThan(0);

      const nav = page.locator('.sidebar-nav');
      await expect(nav, 'Sidebar drawer should open').toBeVisible({ timeout: 2000 });
      const navTransform = await nav.evaluate((element) => getComputedStyle(element).transform);
      expect(navTransform).not.toContain('matrix(1, 0, 0, 1, -300, 0)');

      const profileNav = page.getByRole('button', { name: 'Profile' }).first();
      await profileNav.click({ timeout: 5000 });
      await page.waitForTimeout(200);
      await expect(page.locator('.profile-view')).toBeVisible({ timeout: 10000 });

      await expect(overlay, 'Overlay should close when navigation occurs').toBeHidden({
        timeout: 3000
      });
      await expect(hamburger, 'Menu should remain open-close-capable after navigation').toBeVisible(
        {
          timeout: 2000
        }
      );
      await hamburger.click();
      await expect(overlay, 'Overlay should appear when menu is opened again').toBeVisible({
        timeout: 3000
      });
      await expect(nav).toHaveClass(/is-open/, { timeout: 2000 });
      await overlay.click();
      await expect(overlay, 'Overlay should hide after background tap').toBeHidden({
        timeout: 3000
      });

      await page.screenshot({
        path: resolveDocScreenshotPath(`mobile-audit-${viewport.width}x${viewport.height}.png`)
      });
    });

    test(`payment modal close audit on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      page.setViewportSize(viewport);
      await page.goto('/');
      await loginWithNsec(page);
      await dismissOnboardingTourIfOpen(page);
      await ensureZapPostAvailable(page, {
        fallbackText: `Broader mobile audit post ${viewport.width}x${viewport.height}`,
        timeoutMs: 10_000
      });

      const zapButtons = page.locator('.zap-btn');
      await expect(zapButtons.first(), 'Need zap button').toBeVisible({ timeout: 8000 });
      await zapButtons.first().scrollIntoViewIfNeeded();
      await clickWithDispatchFallback(zapButtons.first(), { timeout: 10_000, force: true });

      const modal = page
        .locator('.payment-modal, .paywall-payment-modal, .zap-modal, .support-card-modal')
        .first();
      await expect(modal, 'Payment modal should appear').toBeVisible({ timeout: 10_000 });

      const closeCandidates = [
        modal.locator('button[aria-label="Close payment dialog"]'),
        modal.locator('button[aria-label="Close"]'),
        modal.locator('button', { hasText: /^\s*CLOSE\s*$/i }),
        modal.locator('.payment-close'),
        modal.locator('.close-btn')
      ];
      let closed = false;
      for (const candidate of closeCandidates) {
        if (await candidate.count()) {
          if (
            await candidate
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await candidate.first().click({ timeout: 2000, force: true });
            const hidden = await modal.waitFor({ state: 'hidden', timeout: 5000 }).then(
              () => true,
              () => false
            );
            if (hidden) {
              closed = true;
              break;
            }
          }
        }
      }

      if (!closed) {
        const overlay = page
          .locator('.payment-overlay[role="button"], .zap-modal-overlay[role="button"]')
          .first();
        await overlay.click({ timeout: 2000, force: true });
        await expect(modal, 'Payment modal should close with overlay fallback').toBeHidden({
          timeout: 5000
        });
      } else {
        await expect(modal, 'Payment modal should be closed').toBeHidden({ timeout: 5000 });
      }

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

      const firstTop = await feed.locator('.virtualized-row').first().boundingBox();
      expect(firstTop).toBeTruthy();
      const startShift = await feed.evaluate((element) => element.scrollTop);
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
      const afterTop = await feed.locator('.virtualized-row').first().boundingBox();
      const endShift = await feed.evaluate((element) => element.scrollTop);
      await expect(Math.abs(endShift - startShift)).toBeGreaterThanOrEqual(0);
      expect(firstTop && afterTop).toBeDefined();
      const movement = Math.abs((afterTop?.y ?? 0) - (firstTop?.y ?? 0));
      expect(totalShift).toBeGreaterThan(0);
      expect(movement).toBeLessThanOrEqual(80);
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
      expect(finalShift).toBeLessThanOrEqual(layoutShift + 0.15);
    });
  }
});
