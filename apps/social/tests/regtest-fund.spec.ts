import { expect, test } from '@playwright/test';

const shouldRun = process.env.REGTEST_SMOKE === 'true';

test.describe('regtest fund', () => {
  test.skip(!shouldRun, 'Set REGTEST_SMOKE=true to run real regtest fund test');

  test('fund wallet updates block height', async ({ page }) => {
    await page.goto('/');

    const loginBtn = page.getByText('Enter nsec manually');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page
        .getByPlaceholder('nsec1...')
        .fill('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5');
      await page.getByRole('button', { name: 'Sign in' }).click();
    }

    await expect(page.getByText('Wallet')).toBeVisible({ timeout: 15000 });

    // Find Block Height element
    const heightStat = page.locator('.ns-stat:has-text("Block Height") .ns-stat-value');
    await expect(heightStat).toBeVisible();

    // Get initial height (clean up commas etc)
    const initialText = await heightStat.textContent();
    const initialHeight = parseInt((initialText || '0').replace(/,/g, ''), 10);
    console.log('Initial height:', initialHeight);

    // Click "Add funds (regtest)"
    const fundBtn = page.getByRole('button', { name: 'Add funds (regtest)' });
    await expect(fundBtn).toBeVisible();
    await fundBtn.click();

    // Toast should appear and say "mined"
    await expect(page.getByText(/Funded & mined/)).toBeVisible({ timeout: 30000 });

    // Verify height increased
    // The update should be "immediate" or nearly so
    await expect(async () => {
      const currentText = await heightStat.textContent();
      const currentHeight = parseInt((currentText || '0').replace(/,/g, ''), 10);
      expect(currentHeight).toBeGreaterThan(initialHeight);
    }).toPass({ timeout: 5000 }); // Wait up to 5s, but it should be faster
  });
});
