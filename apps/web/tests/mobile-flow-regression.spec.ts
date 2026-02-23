import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';

import { clickAndExpectPaymentModal, closePaymentModal, loginWithNsec, TEST_NSEC } from './helpers';
import { mockLnurlPay } from './helpers/lnurl-mocks';
import { installMockRelay } from './helpers/mock-websocket.ts';

test.describe('mobile regression interaction matrix', () => {
  test('sidebar and profile navigation are tappable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await loginWithNsec(page, TEST_NSEC);

    const hamburger = page.locator('.hamburger-btn');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const nav = page.locator('.sidebar-nav');
    await expect(nav).toHaveClass(/is-open/);
    await expect(nav).toBeVisible();
    await expect(page.locator('.sidebar-overlay')).toHaveClass(/is-visible/);

    await nav.getByRole('button', { name: 'Offers' }).click();
    await expect(page).toHaveURL(/\/offers\/?$/);
    await expect(page.locator('.offers-view')).toBeVisible({ timeout: 5000 });

    await hamburger.click();
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('.profile-view')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/p\/|\/profile\/?$/);
    await expect(page.locator('.sidebar-overlay')).not.toHaveClass(/is-visible/);
    await expect(nav).not.toHaveClass(/is-open/);

    await page.goto('/profile');
    await expect(page.locator('.profile-view')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/p\/|\/profile\/?$/);

    await hamburger.click();
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible({
      timeout: 5000
    });
    await expect(page.locator('.sidebar-overlay')).not.toHaveClass(/is-visible/);
    await expect(nav).not.toHaveClass(/is-open/);

    await hamburger.click();
    await nav.getByRole('button', { name: 'Feed' }).click();
    await expect(page.locator('.feed-stream')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sidebar-overlay')).not.toHaveClass(/is-visible/);
    await expect(nav).not.toHaveClass(/is-open/);
  });

  test('zap action opens payment modal on mobile and close path is reliable', async ({ page }) => {
    const secretKey = generateSecretKey();
    const now = Math.floor(Date.now() / 1000);

    const profileEvent = finalizeEvent(
      {
        kind: 0,
        created_at: now,
        tags: [],
        content: JSON.stringify({ name: 'Mobile Friend', lud16: 'mobile@example.com' })
      },
      secretKey
    );

    const post = finalizeEvent(
      {
        kind: 1,
        created_at: now - 5,
        tags: [],
        content: 'Mobile payment regression post'
      },
      secretKey
    );

    await page.setViewportSize({ width: 390, height: 844 });

    await installMockRelay(page, [profileEvent, post], {
      zapAddress: 'https://mock.lnurl/lnurlp/test'
    });
    await mockLnurlPay(page, {
      callback: 'https://localhost:4173/mock-lnurl-callback',
      metadataText: 'Mobile payment regression'
    });

    await loginWithNsec(page, TEST_NSEC);

    const firstZap = page.locator('.zap-btn').first();
    await expect(firstZap).toBeVisible({ timeout: 8000 });
    await firstZap.scrollIntoViewIfNeeded();
    await clickAndExpectPaymentModal(page, firstZap, { force: true });

    const modal = page.locator('.payment-modal, .paywall-payment-modal, .zap-modal');
    await expect(modal.first()).toBeVisible({ timeout: 8000 });
    await closePaymentModal(page, modal.first());

    await expect(page.locator('.feed-stream')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.payment-modal, .paywall-payment-modal, .zap-modal')).toHaveCount(0);
    await expect(page.locator('.sidebar-overlay')).not.toHaveClass(/is-visible/, { timeout: 2500 });

    const profileNav = page.getByRole('button', { name: 'Profile' });
    if ((await profileNav.count()) > 0) {
      await expect(profileNav.first()).toBeVisible({ timeout: 1000 });
      await profileNav
        .first()
        .click({ force: true })
        .catch(() => undefined);
    }
  });
});
