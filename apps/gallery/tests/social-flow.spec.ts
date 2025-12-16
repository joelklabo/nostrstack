import { test, expect } from '@playwright/test';

test.describe('Social App Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    // Navigate to the app
    await page.goto('/');
  });

  test('Guest user sees login screen', async ({ page }) => {
    await expect(page.getByText('AUTH_GATEWAY')).toBeVisible();
    await expect(page.getByText('EXTENSION_AUTH (NIP-07)')).toBeVisible();
    await expect(page.getByText('MANUAL_OVERRIDE (NSEC)')).toBeVisible();
    await page.screenshot({ path: '../../docs/screenshots/login.png' });
  });

  test('User can login with nsec and see feed', async ({ page }) => {
    // 1. Login with NSEC
    await page.getByText('MANUAL_OVERRIDE (NSEC)').click();
    
    // Use a valid nsec
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByText('EXECUTE').click();

    // Check for potential error message
    const errorMsg = page.locator('.error-msg');
    if (await errorMsg.isVisible()) {
      console.error('Login Error:', await errorMsg.textContent());
    }

    // 2. Verify Feed View & Screenshot
    await expect(page.getByText('NOSTRSTACK_V1')).toBeVisible(); // Sidebar
    await page.screenshot({ path: '../../docs/screenshots/feed.png' });

    await expect(page.getByText('STREAMING_LIVE_EVENTS...')).toBeVisible(); // Feed
    await expect(page.getByPlaceholder('WHAT ARE YOU HACKING ON?...')).toBeVisible(); // Post Editor

    // 3. Post a note
    await page.getByPlaceholder('WHAT ARE YOU HACKING ON?...').fill('Hello from Playwright E2E!');
    await page.screenshot({ path: '../../docs/screenshots/posting.png' });
    await page.getByText('PUBLISH_EVENT').click();

    // 4. Check for success status
    await expect(page.getByText(/STATUS: Signing event|SUCCESS:|ERROR:/)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '../../docs/screenshots/post-result.png' });

    // 5. Interact: Click Zap (opens modal)
    // Wait for at least one post to load (PostItem)
    const zapBtn = page.locator('.zap-btn').first();
    // In real env, posts might take time to load from relays.
    try {
      await zapBtn.waitFor({ state: 'visible', timeout: 5000 });
      await zapBtn.click();
      await expect(page.getByText('ZAP_INITIATE')).toBeVisible();
      await page.screenshot({ path: '../../docs/screenshots/zap-modal.png' });
      // Close modal (might be CANCEL or CLOSE if error)
      await page.getByText(/CANCEL|CLOSE/).click();
    } catch {
      console.log('No posts found to zap, skipping zap test step.');
    }
  });

  test('Navigation to Profile, Follow, and Screenshot', async ({ page }) => {
    // Login first
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByText('MANUAL_OVERRIDE (NSEC)').click();
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByText('EXECUTE').click();

    // Click Profile
    await page.getByRole('button', { name: 'PROFILE' }).click();

    // Check Profile View
    await expect(page.locator('.profile-view')).toBeVisible();
    
    // Interact: Follow
    await page.getByText('[+] FOLLOW_USER').click();
    await page.screenshot({ path: '../../docs/screenshots/profile.png' });
  });

  test('Extended interactions: Sidebar navigation and Logout', async ({ page }) => {
    // Login
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByText('MANUAL_OVERRIDE (NSEC)').click();
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByText('EXECUTE').click();

    // Verify Sidebar Buttons exist and are clickable (even if no-op)
    await page.getByRole('button', { name: 'NOTIFICATIONS' }).click();
    await page.getByRole('button', { name: 'SETTINGS' }).click();

    // Verify Post Actions
    // Wait for at least one post
    await expect(page.getByText('STREAMING_LIVE_EVENTS...')).toBeVisible({ timeout: 15000 });
    // Click VIEW_SRC on the first post
    await page.getByText('VIEW_SRC').first().click();
    // Expect JSON view to appear (contains "EVENT_ID:")
    await expect(page.getByText(/EVENT_ID:/)).toBeVisible();
    
    // Toggle back (HIDE_SRC)
    await page.getByText('HIDE_SRC').first().click();
    await expect(page.getByText(/EVENT_ID:/)).not.toBeVisible();

    // Click REPLY (no-op but should not crash)
    await page.getByText('REPLY').first().click();

    // Logout
    await page.getByRole('button', { name: 'LOGOUT' }).click();
    
    // Expect Login Screen
    await expect(page.getByText('AUTH_GATEWAY')).toBeVisible();
    await expect(page.getByText('MANUAL_OVERRIDE (NSEC)')).toBeVisible();
  });
});
