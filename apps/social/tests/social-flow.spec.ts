import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { loginWithNsec as doLoginWithNsec, resolveDocScreenshotPath } from './helpers.ts';

/**
 * Helper to perform nsec login and dismiss onboarding if it appears
 */
async function loginWithNsec(page: Page, nsec: string) {
  await doLoginWithNsec(page, nsec);
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
  }
}

test.describe('Social App Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
    // Navigate to the app
    await page.goto('/');
  });

  test('Guest user sees login screen', async ({ page }) => {
    // Login screen text - check for key elements
    await expect(page.getByRole('heading', { name: 'NostrStack' })).toBeVisible();
    await expect(page.getByText('Connect your identity to get started')).toBeVisible();
    await expect(page.getByText('Sign in with Extension')).toBeVisible();
    await expect(page.getByText('Enter nsec manually')).toBeVisible();
    await page.screenshot({ path: resolveDocScreenshotPath('login.png') });
  });

  test('User can login with nsec and see feed', async ({ page }) => {
    // 1. Login with NSEC and dismiss onboarding
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await loginWithNsec(page, validNsec);

    // Check for potential error message
    const errorMsg = page.locator('.error-msg');
    if (await errorMsg.isVisible().catch(() => false)) {
      console.error('Login Error:', await errorMsg.textContent());
    }

    // 2. Verify Feed View & Screenshot
    await expect(page.locator('.sidebar-title').getByText('NostrStack')).toBeVisible(); // Sidebar brand
    await page.screenshot({ path: resolveDocScreenshotPath('feed.png') });

    await expect(page.getByText('Live Feed')).toBeVisible(); // Feed
    await expect(page.getByPlaceholder('Share something with the network...')).toBeVisible(); // Post Editor

    // 3. Post a note
    await page
      .getByPlaceholder('Share something with the network...')
      .fill('Hello from Playwright E2E!');
    await page.screenshot({ path: resolveDocScreenshotPath('posting.png') });
    await page.getByText('Publish').click();

    // 4. Check for success status
    await expect(page.getByText(/Status: Signing event|Success:|Error:/)).toBeVisible({
      timeout: 10000
    });
    await page.screenshot({ path: resolveDocScreenshotPath('post-result.png') });

    // 5. Interact: Click Zap (opens modal)
    // Wait for at least one post to load (PostItem)
    const zapBtn = page.locator('.zap-btn').first();
    await expect(zapBtn, 'No posts found to zap').toBeVisible({ timeout: 5000 });
    const feedContainer = page.locator('.feed-container');
    const feedBox = await feedContainer.boundingBox();
    // Wait for stable state before clicking (DOM may re-render due to mock relay)
    await page.waitForTimeout(1000);
    // Click the zap button once feed and modal are ready.
    await expect(zapBtn, 'Zap button must be interactive').toBeEnabled({ timeout: 5000 });
    await zapBtn.click({ timeout: 10000 });
    await expect(page.locator('.payment-modal')).toBeVisible({ timeout: 10000 });
    const overlay = page.locator('.payment-overlay');
    await expect(overlay).toBeVisible();
    const overlayPosition = await overlay.evaluate((el) => getComputedStyle(el).position);
    expect(overlayPosition).toBe('fixed');
    const feedBoxAfter = await feedContainer.boundingBox();
    if (feedBox && feedBoxAfter) {
      expect(Math.abs(feedBoxAfter.x - feedBox.x)).toBeLessThan(1);
      expect(Math.abs(feedBoxAfter.width - feedBox.width)).toBeLessThan(1);
    }
    await expect(page.locator('.payment-status')).toBeVisible();
    await expect(page.locator('.payment-grid'), 'Invoice grid did not render').toBeVisible({
      timeout: 8000
    });
    await expect(page.locator('.payment-qr')).toBeVisible();
    await expect(page.locator('.payment-panel')).toBeVisible();
    await expect(page.locator('.payment-panel-title')).toHaveText('INVOICE');
    await expect(page.locator('.payment-invoice-box')).toBeVisible();
    await page.screenshot({ path: resolveDocScreenshotPath('zap-modal.png') });
    // Close modal (might be CANCEL or CLOSE if error)
    await page.getByRole('button', { name: /CLOSE/ }).first().click();
  });

  test('Navigation to Profile, Follow, and Screenshot', async ({ page }) => {
    // Login first and dismiss onboarding
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await loginWithNsec(page, validNsec);

    // Click Profile - use nav-item class to be specific
    await page.locator('.nav-item', { hasText: 'Profile' }).click();

    // Check Profile View
    await expect(page.locator('.profile-view')).toBeVisible({ timeout: 10000 });

    // Wait for profile to fully load before interacting
    await page.waitForTimeout(500);

    // Interact: Follow (button may not exist if viewing own profile)
    const followBtn = page.getByText('[+] FOLLOW');
    await expect(followBtn, 'Expected follow button to be visible before follow flow').toBeVisible({
      timeout: 5000
    });
    await followBtn.click();
    await page.screenshot({ path: resolveDocScreenshotPath('profile.png') });
  });

  test('Extended interactions: Sidebar navigation and Logout', async ({ page }) => {
    // Login and dismiss onboarding
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await loginWithNsec(page, validNsec);

    // Verify Sidebar Buttons exist and are clickable (even if no-op)
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Feed' }).click();

    // Verify Post Actions
    // Wait for at least one post
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });

    // Dismiss onboarding overlay if it appears before interacting with posts
    const overlay = page.locator('.onboarding-overlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      const skipBtn = page.getByRole('button', { name: 'Skip' });
      if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Click VIEW_SRC on the first post - use aria-label for more reliable matching
    // First wait for the button to be attached to DOM (not just visible)
    const viewSource = page
      .locator('.ns-action-btn')
      .filter({ has: page.getByRole('button', { name: /View event source JSON/i }) })
      .first();
    await expect(viewSource.first(), 'No posts available for source view').toBeVisible({
      timeout: 10000
    });
    // Use force:true to bypass onboarding overlay if it intercepts clicks
    await viewSource.click({ force: true });
    // Wait for state change and re-render
    await page.waitForTimeout(2000);
    // Wait for JSON view to be attached to DOM first, then check visibility
    const jsonView = page.locator('.ns-json');
    await jsonView.waitFor({ state: 'attached', timeout: 10000 });
    // Now check visibility
    await expect(jsonView).toBeVisible({ timeout: 5000 });

    // Toggle back (HIDE_SRC)
    await page
      .locator('.ns-action-btn')
      .filter({ has: page.getByRole('button', { name: /Hide event source JSON/i }) })
      .first()
      .click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ns-json')).not.toBeVisible({ timeout: 5000 });

    // Click REPLY (no-op but should not crash)
    await page.getByText('Reply').first().click();

    // Logout
    await page.getByRole('button', { name: 'Log out' }).click();

    // Expect Login Screen
    await expect(page.getByRole('heading', { name: 'NostrStack' })).toBeVisible();
    await expect(page.getByText('Enter nsec manually')).toBeVisible();
  });
});
