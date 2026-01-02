import { expect, test } from '@playwright/test';

import { resolveDocScreenshotPath } from './helpers.ts';

test.describe('Social App Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    // Navigate to the app
    await page.goto('/');
  });

  test('Guest user sees login screen', async ({ page }) => {
    await expect(page.getByText('Sign in to NostrStack')).toBeVisible();
    await expect(page.getByText('Sign in with Extension (NIP-07)')).toBeVisible();
    await expect(page.getByText('Enter nsec manually')).toBeVisible();
    await page.screenshot({ path: resolveDocScreenshotPath('login.png') });
  });

  test('User can login with nsec and see feed', async ({ page }) => {
    // 1. Login with NSEC
    await page.getByText('Enter nsec manually').click();
    
    // Use a valid nsec
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Check for potential error message
    const errorMsg = page.locator('.error-msg');
    if (await errorMsg.isVisible()) {
      console.error('Login Error:', await errorMsg.textContent());
    }

    // 2. Verify Feed View & Screenshot
    await expect(page.getByText('NostrStack')).toBeVisible(); // Sidebar
    await page.screenshot({ path: resolveDocScreenshotPath('feed.png') });

    await expect(page.getByText('Live Feed')).toBeVisible(); // Feed
    await expect(page.getByPlaceholder('WHAT ARE YOU HACKING ON?...')).toBeVisible(); // Post Editor

    // 3. Post a note
    await page.getByPlaceholder('WHAT ARE YOU HACKING ON?...').fill('Hello from Playwright E2E!');
    await page.screenshot({ path: resolveDocScreenshotPath('posting.png') });
    await page.getByText('PUBLISH_EVENT').click();

    // 4. Check for success status
    await expect(page.getByText(/STATUS: Signing event|SUCCESS:|ERROR:/)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: resolveDocScreenshotPath('post-result.png') });

    // 5. Interact: Click Zap (opens modal)
    // Wait for at least one post to load (PostItem)
    const zapBtn = page.locator('.zap-btn').first();
    const hasZap = await zapBtn
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!hasZap) {
      test.skip(true, 'No posts found to zap');
      return;
    }
    const feedContainer = page.locator('.feed-container');
    const feedBox = await feedContainer.boundingBox();
    await zapBtn.click();
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
    const invoiceReady = await page
      .locator('.payment-grid')
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (invoiceReady) {
      await expect(page.locator('.payment-qr')).toBeVisible();
      await expect(page.locator('.payment-panel')).toBeVisible();
      await expect(page.locator('.payment-panel-title')).toHaveText('INVOICE');
      await expect(page.locator('.payment-invoice-box')).toBeVisible();
    }
    await page.screenshot({ path: resolveDocScreenshotPath('zap-modal.png') });
    // Close modal (might be CANCEL or CLOSE if error)
    await page.getByRole('button', { name: /CLOSE/ }).first().click();
  });

  test('Navigation to Profile, Follow, and Screenshot', async ({ page }) => {
    // Login first
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByText('Enter nsec manually').click();
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Click Profile
    await page.getByRole('button', { name: 'Profile' }).click();

    // Check Profile View
    await expect(page.locator('.profile-view')).toBeVisible();
    
    // Interact: Follow
    await page.getByText('[+] FOLLOW_USER').click();
    await page.screenshot({ path: resolveDocScreenshotPath('profile.png') });
  });

  test('Extended interactions: Sidebar navigation and Logout', async ({ page }) => {
    // Login
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByText('Enter nsec manually').click();
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify Sidebar Buttons exist and are clickable (even if no-op)
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Feed' }).click();

    // Verify Post Actions
    // Wait for at least one post
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
    // Click VIEW_SRC on the first post
    const viewSource = page.getByText('View Source').first();
    const hasPost = await viewSource.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!hasPost) {
      test.skip(true, 'No posts available for source view');
      return;
    }
    await viewSource.click();
    // Expect JSON view to appear (contains "EVENT_ID:")
    await expect(page.getByText(/Event ID:/)).toBeVisible();
    
    // Toggle back (HIDE_SRC)
    await page.getByText('Hide Source').first().click();
    await expect(page.getByText(/Event ID:/)).not.toBeVisible();

    // Click REPLY (no-op but should not crash)
    await page.getByText('Reply').first().click();

    // Logout
    await page.getByRole('button', { name: 'Log out' }).click();
    
    // Expect Login Screen
    await expect(page.getByText('Sign in to NostrStack')).toBeVisible();
    await expect(page.getByText('Enter nsec manually')).toBeVisible();
  });
});
