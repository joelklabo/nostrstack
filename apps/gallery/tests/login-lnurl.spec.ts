import { expect, test } from '@playwright/test';

test('lnurl-auth modal renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sign in to NostrStack')).toBeVisible();

  const lnurlButton = page.getByRole('button', { name: /Login with Lightning/i });
  await expect(lnurlButton).toBeVisible();
  await lnurlButton.click();

  await expect(page.locator('.lnurl-auth-modal')).toBeVisible();
  await expect(page.locator('.lnurl-auth-title')).toHaveText('Lightning Login');
});
