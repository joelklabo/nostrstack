import { expect, test } from '@playwright/test';

import { loginWithNsec } from './helpers.ts';

const VALID_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('Reply Composer', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
  });

  test('user can open reply modal and post a reply', async ({ page }) => {
    await loginWithNsec(page, VALID_NSEC);

    // Wait for posts to load
    await expect(page.locator('.post-card').first()).toBeVisible({ timeout: 15000 });

    const firstPost = page.locator('.post-card').first();
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
});
