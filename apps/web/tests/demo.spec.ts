import { expect, test } from '@playwright/test';

test.describe('Legacy demo route handling', () => {
  test('falls back to login when /demo is accessed unauthenticated', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: 'NostrStack' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browse as Guest' })).toBeVisible();
  });
});
