import { expect, test } from '@playwright/test';

import {
  dismissOnboardingTourIfOpen,
  ensureZapPostAvailable,
  loginWithNsec,
  TEST_NSEC
} from './helpers.ts';

const VALID_NSEC = TEST_NSEC;

test.describe('Reply Composer', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
  });

  test('user can open reply modal and post a reply', async ({ page }) => {
    await loginWithNsec(page, VALID_NSEC);

    // Wait for posts to load
    await expect(page.locator('[data-testid="web-event-card"]').first()).toBeVisible({
      timeout: 15000
    });

    const firstPost = page.locator('[data-testid="web-event-card"]').first();
    const replyBtn = firstPost.getByRole('button', { name: 'Reply' });

    // Click reply
    await replyBtn.click();

    // Verify modal open
    const modal = page.locator('dialog.reply-modal[open]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Reply to note' })).toBeVisible();

    // Fill reply
    await modal
      .getByPlaceholder(/YOUR_REPLY|Write your reply/i)
      .fill('This is a test reply from Playwright!');

    // Click publish in modal
    await modal.getByRole('button', { name: 'Publish' }).click();

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Success toast check (optional, depending on toast implementation)
    // await expect(page.getByText('Reply published!')).toBeVisible();
  });

  test('reply close does not block copy action after thread navigation', async ({ page }) => {
    await loginWithNsec(page, VALID_NSEC);
    await dismissOnboardingTourIfOpen(page);
    await ensureZapPostAvailable(page);

    const firstPost = page.locator('[data-testid="web-event-card"]').first();
    const replyBtn = firstPost.getByTestId('web-event-reply');
    const threadBtn = firstPost.getByTestId('web-event-thread');
    const copyBtn = firstPost.getByTestId('web-event-copy-link');

    await replyBtn.click();
    await expect(page.locator('dialog.reply-modal[open]')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.reply-modal[open]')).not.toBeVisible({ timeout: 10000 });

    await threadBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/nostr\//, { timeout: 10000 });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('dialog.reply-modal[open]')).not.toBeVisible();

    await expect(copyBtn).toBeVisible({ timeout: 10000 });
    await copyBtn.click({ timeout: 10000 });
  });
});
