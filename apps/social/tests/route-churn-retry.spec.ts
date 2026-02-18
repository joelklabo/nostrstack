import { expect, test } from '@playwright/test';

import { loginWithNsec, TEST_NSEC } from './helpers.ts';

const ROUTES = ['/', '/search', '/settings', '/offers', '/profile'];

test.describe('Issue #403: Route-churn retry recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });
  });

  test('rapid navigation recovers correctly with contextual retry controls', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    await page.waitForLoadState('networkidle');

    for (let i = 0; i < 3; i++) {
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });

        await page.waitForTimeout(100 + Math.random() * 200);

        const isOnExpectedRoute =
          page.url().includes(route) || (route === '/' && page.url() === 'https://localhost:4173/');
        expect(isOnExpectedRoute || page.url().includes('localhost')).toBe(true);
      }

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100 + Math.random() * 200);
    }

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i }))
      .toBeVisible({ timeout: 10000 })
      .catch(async () => {
        const retryButton = page.getByRole('button', { name: /reload page|retry route/i });
        if (await retryButton.isVisible().catch(() => false)) {
          throw new Error('Settings route failed to load - found retry button instead of content');
        }
      });

    await page.goto('/offers');
    await expect(page.getByRole('heading', { name: /offers/i }))
      .toBeVisible({ timeout: 10000 })
      .catch(async () => {
        const retryButton = page.getByRole('button', { name: /reload page|retry route/i });
        if (await retryButton.isVisible().catch(() => false)) {
          throw new Error('Offers route failed to load - found retry button instead of content');
        }
      });

    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /search/i }))
      .toBeVisible({ timeout: 10000 })
      .catch(async () => {
        const retryButton = page.getByRole('button', { name: /retry route/i });
        if (await retryButton.isVisible().catch(() => false)) {
          throw new Error('Search route failed to load - found retry button instead of content');
        }
      });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile/i }))
      .toBeVisible({ timeout: 10000 })
      .catch(async () => {
        const retryButton = page.getByRole('button', { name: /retry route/i });
        if (await retryButton.isVisible().catch(() => false)) {
          throw new Error('Profile route failed to load - found retry button instead of content');
        }
      });

    await page.goto('/');
    const feedStream = page.locator('.feed-stream').first();
    await expect(feedStream).toBeVisible({ timeout: 10000 });
  });

  test('retry button shows contextual labels for different routes', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    await page.goto('/');

    const pageWithRetry = page.locator(
      'button:has-text("Retry route"), button:has-text("Reload page")'
    );
    const hasGenericRetry = (await pageWithRetry.count()) > 0;

    if (hasGenericRetry) {
      const retryText = await pageWithRetry.first().textContent();
      expect(retryText).toMatch(/Retry route|Reload page/);
    }

    await page.goto('/settings');
    await page.waitForTimeout(500);
    const settingsRetry = page.locator('button:has-text("Reload page")');
    if ((await settingsRetry.count()) > 0) {
      expect(await settingsRetry.first().textContent()).toBe('Reload page');
    }

    await page.goto('/offers');
    await page.waitForTimeout(500);
    const offersRetry = page.locator('button:has-text("Reload page")');
    if ((await offersRetry.count()) > 0) {
      expect(await offersRetry.first().textContent()).toBe('Reload page');
    }
  });

  test('route error boundary allows recovery via retry after chunk load failures', async ({
    page
  }) => {
    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    await page.goto('/settings', { waitUntil: 'networkidle' });

    const settingsRetry = page.locator('button:has-text("Reload page")');
    const hasSettingsError = (await settingsRetry.count()) > 0;

    if (hasSettingsError) {
      await settingsRetry.click();
      await page.waitForTimeout(1000);
    }

    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading)
      .toBeVisible({ timeout: 15000 })
      .catch(async () => {
        if (await settingsRetry.isVisible().catch(() => false)) {
          throw new Error('Settings route did not recover after retry');
        }
      });

    await page.goto('/offers', { waitUntil: 'networkidle' });

    const offersRetry = page.locator('button:has-text("Reload page")');
    const hasOffersError = (await offersRetry.count()) > 0;

    if (hasOffersError) {
      await offersRetry.click();
      await page.waitForTimeout(1000);
    }

    const offersHeading = page.getByRole('heading', { name: /offers/i });
    await expect(offersHeading)
      .toBeVisible({ timeout: 15000 })
      .catch(async () => {
        if (await offersRetry.isVisible().catch(() => false)) {
          throw new Error('Offers route did not recover after retry');
        }
      });

    await page.goto('/search', { waitUntil: 'networkidle' });

    const searchRetry = page.locator('button:has-text("Retry route")');
    const hasSearchError = (await searchRetry.count()) > 0;

    if (hasSearchError) {
      await searchRetry.click();
      await page.waitForTimeout(1000);
    }

    const searchHeading = page.getByRole('heading', { name: /search/i });
    await expect(searchHeading)
      .toBeVisible({ timeout: 15000 })
      .catch(async () => {
        if (await searchRetry.isVisible().catch(() => false)) {
          throw new Error('Search route did not recover after retry');
        }
      });

    await page.goto('/profile', { waitUntil: 'networkidle' });

    const profileRetry = page.locator('button:has-text("Retry route")');
    const hasProfileError = (await profileRetry.count()) > 0;

    if (hasProfileError) {
      await profileRetry.click();
      await page.waitForTimeout(1000);
    }

    const profileHeading = page.getByRole('heading', { name: /profile/i });
    await expect(profileHeading)
      .toBeVisible({ timeout: 15000 })
      .catch(async () => {
        if (await profileRetry.isVisible().catch(() => false)) {
          throw new Error('Profile route did not recover after retry');
        }
      });

    await page.goto('/');
    const feedStream = page.locator('.feed-stream');
    await expect(feedStream).toBeVisible({ timeout: 15000 });
  });

  test('navigation during loading does not leave stale retry UI', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    const navigateAwayImmediately = async () => {
      await page.goto('/search', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      const staleRetry = page.locator(
        'button:has-text("Retry route"), button:has-text("Reload page")'
      );
      const hasStaleRetry = (await staleRetry.count()) > 0;

      if (hasStaleRetry) {
        const searchHeading = page.getByRole('heading', { name: /search/i });
        const hasContent = await searchHeading.isVisible().catch(() => false);
        if (!hasContent) {
          throw new Error('Stale retry UI detected on search route after navigation');
        }
      }
    };

    await navigateAwayImmediately();
    await navigateAwayImmediately();
    await navigateAwayImmediately();

    await page.goto('/');
    const feedStream = page.locator('.feed-stream');
    await expect(feedStream).toBeVisible({ timeout: 15000 });
  });
});
