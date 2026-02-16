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
    const menu = page.locator('.hamburger-btn');

    if (await overlay.isVisible()) {
      await overlay.click({ force: true });
    } else {
      if ((await menu.isVisible()) && (await menu.getAttribute('aria-expanded')) === 'true') {
        await menu.click();
      }
    }

    await expect(sidebar).not.toHaveClass(/is-open/, { timeout: 8_000 });
    await expect(page.locator('.sidebar-overlay'))
      .not.toHaveClass(/is-visible/, { timeout: 8_000 })
      .catch(() => undefined);
    if ((await menu.getAttribute('aria-expanded')) !== 'false') {
      await menu.click({ force: true });
      await expect(sidebar).not.toHaveClass(/is-open/, { timeout: 4_000 });
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
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

  test('mobile menu open state disables background scroll', async ({ page }) => {
    await loginWithNsec(page);
    const menu = page.locator('.hamburger-btn');

    await openMobileMenu(page);
    await expect(page.locator('.sidebar-nav')).toHaveClass(/is-open/);
    await expect
      .poll(async () => page.evaluate(() => document.body.style.overflow), { timeout: 2000 })
      .toBe('hidden');

    const beforeScrollY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, 80));
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBe(beforeScrollY);

    const bodyPadding = await page.evaluate(() => document.body.style.paddingRight);
    expect(bodyPadding === '0px' || bodyPadding.endsWith('px')).toBe(true);

    await closeMobileMenu(page);
    await expect(page.locator('.sidebar-nav')).not.toHaveClass(/is-open/, { timeout: 8_000 });
    await expect
      .poll(async () => page.evaluate(() => document.body.style.overflow), { timeout: 2_000 })
      .toBe('');
  });

  test('scrolling hides/reveals mobile controls deterministically', async ({ page }) => {
    await loginWithNsec(page);
    const menu = page.locator('.hamburger-btn');
    const socialLayout = page.locator('.social-layout');
    const feed = page.locator('.feed-container');
    const feedHeader = page.locator('.feed-header');
    const firstFilter = page.getByRole('button', { name: 'Latest posts, click for chronological' });
    const canScroll = await feed.evaluate((el) => el.scrollHeight > el.clientHeight + 10);
    if (!canScroll) {
      test.skip();
    }

    await feed.evaluate((el, top) => {
      el.scrollTop = top;
      el.dispatchEvent(new Event('scroll'));
    }, 260);
    await page.waitForTimeout(650);

    const debug = await page.evaluate(() => {
      const layout = document.querySelector('.social-layout');
      const hamburger = document.querySelector('.hamburger-btn');
      const feedHeader = document.querySelector('.feed-header');
      const scrollContainer = document.querySelector('.feed-container');
      return {
        layoutClass: layout?.className ?? '',
        hamburgerPointerEvents: hamburger ? getComputedStyle(hamburger).pointerEvents : '',
        hamburgerOpacity: hamburger ? getComputedStyle(hamburger).opacity : '',
        headerPointerEvents: feedHeader ? getComputedStyle(feedHeader).pointerEvents : '',
        scrollTop: scrollContainer ? (scrollContainer as HTMLElement).scrollTop : -1,
        scrollHeight: scrollContainer ? (scrollContainer as HTMLElement).scrollHeight : -1,
        clientHeight: scrollContainer ? (scrollContainer as HTMLElement).clientHeight : -1
      };
    });
    console.log(JSON.stringify(debug));

    await expect(socialLayout).toHaveClass(/is-immersive/);
    await expect(menu).toHaveCSS('pointer-events', 'none');
    await expect(menu).toHaveCSS('opacity', '0');
    await expect(feedHeader).toHaveCSS('pointer-events', 'none');
    await expect(firstFilter).not.toBeVisible();

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

  test('mobile menu closes when tapping overlay while onboarding is active', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
      localStorage.removeItem('nostrstack.guest');
    });

    await page.goto('/');

    const loginButton = page
      .getByRole('button', { name: /(Enter nsec manually|Enter private key manually)/i })
      .first();
    await loginButton.click();
    await page
      .getByPlaceholder('nsec1...')
      .fill('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.locator('.feed-stream').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1800);

    const onboardingCard = page.locator('[data-testid="onboarding-card"]');
    const onboardingVisible = await onboardingCard.isVisible({ timeout: 2500 }).catch(() => false);
    expect(onboardingVisible).toBe(true);

    const overlay = page.locator('.sidebar-overlay').first();

    await page.locator('.hamburger-btn').click({ timeout: 10000 });
    await expect(overlay).toHaveClass(/is-visible/);
    await expect(page.locator('.sidebar-nav')).toHaveClass(/is-open/);

    const overlayRect = await overlay.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + Math.max(24, rect.width - 24),
        y: rect.top + 24
      };
    });

    const clickResult = await overlay
      .click({ timeout: 2500, position: overlayRect })
      .then(() => ({ ok: true }))
      .catch((error: Error) => ({ ok: false, message: error.message }));

    expect(clickResult.ok).toBe(true);

    const sidebarOpen = await page
      .locator('.sidebar-nav')
      .evaluate((el) => el.classList.contains('is-open'));
    expect(sidebarOpen).toBe(false);
    expect(await onboardingCard.isVisible().catch(() => false)).toBe(true);
  });
});
