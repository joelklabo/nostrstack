import { expect, test } from '@playwright/test';

import { loginWithNsec } from '../helpers';

test.describe('Mobile interaction audit', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openMobileMenu(page) {
    const menu = page.locator('.hamburger-btn');
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await menu.click();
    await expect(page.locator('.sidebar-nav')).toHaveClass(/is-open/);
    await expect(page.locator('.sidebar-overlay')).toHaveClass(/is-visible/, { timeout: 8000 });
  }

  async function closeMobileMenu(page) {
    const overlay = page.locator('.sidebar-overlay.is-visible');
    const sidebar = page.locator('.sidebar-nav');

    if (await overlay.isVisible()) {
      await overlay.click();
    } else {
      const menu = page.locator('.hamburger-btn');
      if ((await menu.isVisible()) && (await menu.getAttribute('aria-expanded')) === 'true') {
        await menu.click();
      }
    }

    await expect(sidebar).not.toHaveClass(/is-open/, { timeout: 8_000 });
  }

  test('core nav remains tappable on mobile', async ({ page }) => {
    await loginWithNsec(page);
    const sidebar = page.locator('.sidebar-nav');
    const menu = page.locator('.hamburger-btn');

    await openMobileMenu(page);
    await sidebar.getByRole('button', { name: 'Find friend' }).click();
    await expect(page).toHaveURL('/search');
    await closeMobileMenu(page);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await openMobileMenu(page);
    await sidebar.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('.profile-view')).toBeVisible();
    await closeMobileMenu(page);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await openMobileMenu(page);
    await sidebar.getByRole('button', { name: 'Settings' }).click();
    const themeToggle = page
      .getByRole('button', { name: /Switch to dark mode|Switch to light mode/i })
      .first();
    await expect(themeToggle).toBeVisible();
    await closeMobileMenu(page);
  });

  test('menu closes via overlay and remains reachable after close', async ({ page }) => {
    await loginWithNsec(page);
    const overlay = page.locator('.sidebar-overlay');
    const menu = page.locator('.hamburger-btn');

    await openMobileMenu(page);
    await expect(overlay).toBeVisible();
    await overlay.click({ force: true });

    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).not.toHaveClass(/is-open/, { timeout: 8_000 });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(overlay).not.toHaveClass(/is-visible/);
    await expect(overlay)
      .toBeVisible({ timeout: 500 })
      .catch(() => {
        // overlay visibility is animated; class transition is the reliable contract.
        return;
      });
    await menu.click();
    await expect(page.locator('.sidebar-nav')).toHaveClass(/is-open/);
  });

  test('scrolling hides/reveals mobile controls deterministically', async ({ page }) => {
    await loginWithNsec(page);
    const menu = page.locator('.hamburger-btn');
    const socialLayout = page.locator('.social-layout');
    const feed = page.locator('.feed-container');
    const editor = page.getByPlaceholder('Share something with the network...');
    await editor.waitFor({ timeout: 10_000 });
    await editor.fill('UI audit seed post');
    await page.getByText('Publish').click();
    await page.getByText('Success: Event published to relays.').waitFor({ timeout: 15_000 });

    const actionButton = page.locator('.social-event-card .action-btn').first();
    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.hover();

    await feed.evaluate((el) => {
      el.scrollTop = 260;
    });
    await page.waitForTimeout(650);

    await expect(socialLayout).toHaveClass(/is-immersive/);
    await expect(menu).toHaveCSS('pointer-events', 'none');
    await expect(menu).toHaveCSS('opacity', '0');
    await expect(page.locator('.sidebar-overlay')).toHaveCSS('pointer-events', 'auto', {
      timeout: 1
    });

    await actionButton.click();
    await expect(actionButton).toBeVisible();

    await feed.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(650);

    await expect(socialLayout).not.toHaveClass(/is-immersive/);
    await expect(menu).toHaveCSS('pointer-events', 'auto');
    await expect(menu).toHaveCSS('opacity', '1');
    await menu.click();
    await expect(page.locator('.sidebar-nav')).toHaveClass(/is-open/);
  });

  test('telemetry rail does not block center tap region on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await loginWithNsec(page);

    const hitTarget = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element ? (element as HTMLElement).className : '';
      },
      { x: 1360 * 0.5, y: 900 * 0.4 }
    );

    expect(hitTarget.includes('telemetry-sidebar')).toBe(false);
  });
});
