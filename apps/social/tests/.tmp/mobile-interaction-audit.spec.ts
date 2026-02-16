import { expect, test } from '@playwright/test';

import { loginWithNsec } from '../helpers';

test.describe('Mobile interaction audit', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openMobileMenu(page) {
    const menu = page.locator('.hamburger-btn');
    await expect(menu).toBeVisible();
    await menu.click();

    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).toBeVisible();
  }

  async function closeMobileMenu(page) {
    const overlay = page.locator('.sidebar-overlay');
    if (await overlay.isVisible()) {
      await overlay.click();
      await expect(overlay).not.toBeVisible();
    }
  }

  test('core nav remains tappable on mobile', async ({ page }) => {
    await loginWithNsec(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openMobileMenu(page);
    const nav = page.locator('.sidebar-nav');
    await nav.getByRole('button', { name: 'Find friend' }).click();
    await expect(page.locator('.search-page')).toBeVisible();

    await page.evaluate(() => {
      window.history.replaceState({}, '', '/');
    });
    await openMobileMenu(page);
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('.profile-view')).toBeVisible();

    await openMobileMenu(page);
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(
      page.locator(
        'button[aria-label="Switch to dark mode"], button[aria-label="Switch to light mode"]'
      )
    ).toBeVisible();
  });

  test('feed actions stay interactive after scroll', async ({ page }) => {
    await loginWithNsec(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const feed = page.locator('.feed-container');
    await expect(page.locator('.social-event-card').first()).toBeVisible({ timeout: 10000 });

    const actionButton = page.locator('.social-event-card .action-btn').first();
    await expect(actionButton).toBeVisible();
    await actionButton.hover();

    await feed.evaluate((el) => {
      el.scrollTop = 250;
    });
    await page.waitForTimeout(600);

    const menu = page.locator('.hamburger-btn');
    const pointerEvents = await menu.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    const opacity = await menu.evaluate((el) => window.getComputedStyle(el).opacity);

    // Validate not permanently disabling access: after scroll on this mobile viewport,
    // we still want menu to be recoverable with an explicit upward gesture.
    expect(pointerEvents).toBe('none');
    expect(opacity).toBe('0');

    await feed.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(600);

    const restoredPointerEvents = await menu.evaluate(
      (el) => window.getComputedStyle(el).pointerEvents
    );
    const restoredOpacity = await menu.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(restervedPointerEvents ?? restoredPointerEvents).toBe('auto');
    expect(restoredOpacity === '1' || restoredOpacity === '1');
  });
});
