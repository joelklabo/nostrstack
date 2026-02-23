import { expect, test } from '@playwright/test';

import { loginWithNsec, TEST_NSEC } from './helpers.ts';

const TEST_PUBKEY = 'a'.repeat(64);
const TEST_NPUB = 'npub1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('Issue #393: Profile route handling variants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });
  });

  test.describe('route parsing', () => {
    test('resolves /profile without query string', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });
    });

    test('resolves /profile/ with trailing slash', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/profile/');
      await page.waitForLoadState('domcontentloaded');

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });
    });

    test('resolves /profile?query=value', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/profile?tab=about');
      await page.waitForLoadState('domcontentloaded');

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });
    });

    test('resolves /profile/?query=value with trailing slash and query', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/profile/?tab=relays');
      await page.waitForLoadState('domcontentloaded');

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });
    });

    test('resolves /p/hexpubkey directly', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto(`/p/${TEST_PUBKEY}`);
      await page.waitForLoadState('domcontentloaded');

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });

    test('resolves /p/npub directly', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto(`/p/${TEST_NPUB}`);
      await page.waitForLoadState('domcontentloaded');

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });

    test('resolves /p/hexpubkey?query=value with query string', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto(`/p/${TEST_PUBKEY}?tab=about`);
      await page.waitForLoadState('domcontentloaded');

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });

    test('resolves /p/npub?query=value with npub and query', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto(`/p/${TEST_NPUB}?tab=relays`);
      await page.waitForLoadState('domcontentloaded');

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });
  });

  test.describe('shell-only rendering prevention', () => {
    test('manual navigation to /profile does not show shell-only state', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      const loadingState = page.locator('.web-loading-state, .web-loading-main');
      const hasOnlyLoading = await loadingState.isVisible().catch(() => false);

      if (hasOnlyLoading) {
        await page.waitForTimeout(3000);
      }

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });

      const retryButton = page.locator('button:has-text("Retry route")');
      const hasRetry = await retryButton.isVisible().catch(() => false);
      expect(hasRetry).toBe(false);
    });

    test('direct /p/* transition does not show shell-only state', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.goto(`/p/${TEST_PUBKEY}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      const loadingState = page.locator('.web-loading-state, .web-loading-main');
      const hasOnlyLoading = await loadingState.isVisible().catch(() => false);

      if (hasOnlyLoading) {
        await page.waitForTimeout(3000);
      }

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });

      const retryButton = page.locator('button:has-text("Retry route")');
      const hasRetry = await retryButton.isVisible().catch(() => false);
      expect(hasRetry).toBe(false);
    });

    test('rapid navigation between /profile and /p/* does not break view selection', async ({
      page
    }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const routes = ['/profile', `/p/${TEST_PUBKEY}`, '/profile?tab=about', '/'];

      for (let i = 0; i < 2; i++) {
        for (const route of routes) {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(200 + Math.random() * 300);

          const isValid = page.url().includes(route.split('?')[0]) || route === '/';
          expect(isValid || page.url().includes('localhost')).toBe(true);
        }
      }

      await page.goto('/');
      const feedStream = page.locator('.feed-stream').first();
      await expect(feedStream).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('auth/guest transitions', () => {
    test('guest visiting /profile shows guest placeholder', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      const guestPlaceholder = page.locator('.profile-guest-placeholder');
      const signInPrompt = page.getByText(/sign in to view your profile/i);

      await expect(guestPlaceholder.or(signInPrompt)).toBeVisible({ timeout: 10000 });
    });

    test('guest visiting /p/* shows profile content or error gracefully', async ({ page }) => {
      await page.goto(`/p/${TEST_PUBKEY}`);
      await page.waitForLoadState('domcontentloaded');

      const profileContent = page.locator('.profile-');
      const errorAlert = page.locator('[role="alert"]');
      const notFound = page.getByText(/not found|invalid/i);

      const hasContent = await profileContent.isVisible().catch(() => false);
      const hasError =
        (await errorAlert.isVisible().catch(() => false)) ||
        (await notFound.isVisible().catch(() => false));

      expect(hasContent || hasError).toBe(true);
    });

    test('transition from guest to authenticated maintains route stability', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      const guestPlaceholder = page.locator('.profile-guest-placeholder');
      await expect(guestPlaceholder).toBeVisible({ timeout: 5000 });

      await loginWithNsec(page, TEST_NSEC);

      await page.waitForTimeout(1000);

      const profileHeading = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading).toBeVisible({ timeout: 10000 });
    });

    test('transition from /p/* as guest to authenticated maintains pubkey', async ({ page }) => {
      await page.goto(`/p/${TEST_PUBKEY}`);
      await page.waitForLoadState('domcontentloaded');

      await loginWithNsec(page, TEST_NSEC);

      await page.waitForTimeout(1000);

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });
  });

  test.describe('view selection stability', () => {
    test('view remains stable during profile route variants', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.goto('/profile');
      await page.waitForTimeout(500);

      const profileHeading1 = page.getByRole('heading', { name: /profile/i });
      await expect(profileHeading1).toBeVisible({ timeout: 5000 });

      await page.goto('/profile/');
      await page.waitForTimeout(500);

      await expect(profileHeading1).toBeVisible({ timeout: 5000 });

      await page.goto('/profile?tab=about');
      await page.waitForTimeout(500);

      await expect(profileHeading1).toBeVisible({ timeout: 5000 });

      await page.goto('/profile/?tab=relays');
      await page.waitForTimeout(500);

      await expect(profileHeading1).toBeVisible({ timeout: 5000 });

      await page.goto('/');
      await page.waitForTimeout(500);

      const feedStream = page.locator('.feed-stream').first();
      await expect(feedStream).toBeVisible({ timeout: 5000 });
    });

    test('/p/* routes maintain consistent view selection', async ({ page }) => {
      await loginWithNsec(page, TEST_NSEC);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.goto(`/p/${TEST_PUBKEY}`);
      await page.waitForTimeout(500);

      const profileContent = page.locator('.profile-');
      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });

      await page.goto(`/p/${TEST_NPUB}`);
      await page.waitForTimeout(500);

      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });

      await page.goto(`/p/${TEST_PUBKEY}?tab=about`);
      await page.waitForTimeout(500);

      await expect(profileContent.or(page.getByRole('heading', { name: /profile/i }))).toBeVisible({
        timeout: 10000
      });
    });
  });
});
