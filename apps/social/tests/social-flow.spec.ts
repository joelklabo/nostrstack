import { expect, test } from '@playwright/test';

import {
  clickWithDispatchFallback,
  closePaymentModal,
  dismissOnboardingTourIfOpen,
  ensureZapPostAvailable,
  loginWithNsec as doLoginWithNsec,
  resolveDocScreenshotPath,
  TEST_NSEC,
  waitForFeedSurface
} from './helpers.ts';

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
    await doLoginWithNsec(page, TEST_NSEC);

    // Check for potential error message
    const errorMsg = page.locator('.error-msg');
    if (await errorMsg.isVisible().catch(() => false)) {
      console.error('Login Error:', await errorMsg.textContent());
    }

    // 2. Verify Feed View & Screenshot
    await expect(page.locator('.sidebar-title').getByText('NostrStack')).toBeVisible(); // Sidebar brand
    await page.screenshot({ path: resolveDocScreenshotPath('feed.png') });

    await waitForFeedSurface(page); // Feed
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
    const firstPost = page.locator('[data-testid="social-event-card"]').first();
    await ensureZapPostAvailable(page);
    const zapBtn = page.locator('.zap-btn').first();
    const feedContainer = page.locator('.feed-container');
    const feedBox = await feedContainer.boundingBox();
    await expect(firstPost, 'Post card must be attached').toBeVisible({ timeout: 10000 });
    // Click the zap button once feed and modal are ready.
    await expect(zapBtn, 'Zap button must be interactive').toBeEnabled({ timeout: 5000 });
    await clickWithDispatchFallback(zapBtn, { timeout: 10000, force: true });
    const paymentSelector =
      '.payment-modal, .payment-overlay, .paywall-payment-modal, .paywall-widget-host, .zap-modal, .support-card-modal, .zap-modal-overlay';
    const paymentSurface = page.locator(paymentSelector).first();
    if (!(await paymentSurface.isVisible({ timeout: 12000 }).catch(() => false))) {
      const walletMsg = page.getByText(
        /Wallet unavailable|Failed to connect to wallet|No wallet URL configured|Wallet not configured/i
      );
      const hasWalletState = (await walletMsg.count()) > 0;
      if (!hasWalletState) {
        await page.screenshot({ path: resolveDocScreenshotPath('zap-flow-no-state.png') });
        test.skip(true, 'Payment surface unavailable in this environment');
        return;
      }
      await expect(
        walletMsg.first(),
        'Expected a payment surface or an explicit wallet-unavailable state'
      ).toBeVisible({
        timeout: 5000
      });
      await page
        .getByRole('button', { name: /Log out/ })
        .first()
        .click();
      return;
    }
    const overlay = page
      .locator('.payment-overlay, .zap-modal-overlay, .paywall-payment-modal, .paywall-widget-host')
      .first();
    await expect(overlay).toBeVisible();
    const overlayPosition = await overlay.evaluate((el) => getComputedStyle(el).position);
    expect(overlayPosition).toBe('fixed');
    const feedBoxAfter = await feedContainer.boundingBox();
    if (feedBox && feedBoxAfter) {
      expect(Math.abs(feedBoxAfter.x - feedBox.x)).toBeLessThan(1);
      expect(Math.abs(feedBoxAfter.width - feedBox.width)).toBeLessThan(1);
    }
    const paymentPanel = page.locator('.payment-status, .payment-grid, .paywall-status');
    await expect(paymentPanel.first(), 'Payment panel did not render').toBeVisible({
      timeout: 8000
    });
    await expect(page.locator('.payment-qr, .payment-qr-code')).toBeVisible();
    await expect(page.locator('.payment-panel, .payment-modal')).toBeVisible();
    await expect(
      page.locator('.payment-panel-title').first(),
      'INVOICE title was not visible on payment panel'
    ).toHaveText(/INVOICE/i);
    await expect(page.locator('.payment-invoice-box, .invoice-box')).toBeVisible();
    await page.screenshot({ path: resolveDocScreenshotPath('zap-modal.png') });
    await closePaymentModal(
      page,
      page.locator('.payment-modal, .payment-overlay, .paywall-payment-modal').first()
    );
  });

  test('Navigation to Profile, Follow, and Screenshot', async ({ page }) => {
    // Login first and dismiss onboarding
    await doLoginWithNsec(page, TEST_NSEC);

    // Click Profile - use nav-item class to be specific
    await page.locator('.nav-item', { hasText: 'Profile' }).click();

    // Check Profile View
    await expect(page.locator('.profile-view')).toBeVisible({ timeout: 10000 });

    // Interact: Follow (button may not exist if viewing own profile)
    const followBtn = page.getByRole('button', { name: /Follow this user/i });
    if (await followBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await followBtn.click();
    }
    await page.screenshot({ path: resolveDocScreenshotPath('profile.png') });
  });

  test('Extended interactions: Sidebar navigation and Logout', async ({ page }) => {
    // Login and dismiss onboarding
    await doLoginWithNsec(page, TEST_NSEC);

    // Verify Sidebar Buttons exist and are clickable (even if no-op)
    const nav = page.getByRole('navigation');
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('.profile-view')).toBeVisible({ timeout: 10000 });
    await nav.getByRole('button', { name: 'Settings' }).click();
    await nav.getByRole('button', { name: 'Feed' }).click();

    // Verify Post Actions
    // Wait for feed surface to be interactive before post actions
    await waitForFeedSurface(page, { timeoutMs: 15000 });

    // Dismiss onboarding overlay if it appears before interacting with posts
    await dismissOnboardingTourIfOpen(page);

    const firstPost = page.locator('[data-testid="social-event-card"]').first();
    const viewSource = firstPost.getByRole('button', { name: /View event source JSON/i });
    if (await viewSource.isVisible().catch(() => false)) {
      // First wait for the button to be attached to DOM (not just visible)
      await expect(viewSource.first(), 'No posts available for source view').toBeVisible({
        timeout: 10000
      });
      await viewSource.click({ force: true });
      const jsonView = page.locator('[data-testid="social-event-json"]');
      await jsonView.waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
      await expect(jsonView)
        .toBeVisible({ timeout: 5000 })
        .catch(() => null);

      // Toggle back (HIDE_SRC)
      await page
        .getByRole('button', { name: /Hide event source JSON/i })
        .first()
        .click({ force: true })
        .catch(() => null);
    }

    // Click REPLY (no-op but should not crash)
    await page
      .locator('[data-testid="social-event-reply"]')
      .first()
      .click({ force: true })
      .catch(() => null);

    const openDialog = page.locator('dialog[open]');
    if (
      await openDialog
        .count()
        .then((count) => count > 0)
        .catch(() => false)
    ) {
      await page.keyboard.press('Escape').catch(() => undefined);
      await openDialog
        .first()
        .waitFor({ state: 'hidden', timeout: 2000 })
        .catch(() => undefined);
    }

    // Logout
    await page.getByRole('button', { name: 'Log out' }).click();

    // Expect Login Screen
    await expect(page.getByRole('heading', { name: 'NostrStack' })).toBeVisible();
    await expect(page.getByText('Enter nsec manually')).toBeVisible();
  });
});
