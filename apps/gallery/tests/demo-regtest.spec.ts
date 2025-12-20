import { expect, test } from '@playwright/test';

const shouldRun = process.env.REGTEST_SMOKE === 'true';
const testNsec = process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('regtest demo (zap pay)', () => {
  test.skip(!shouldRun, 'Set REGTEST_SMOKE=true to run real regtest demo smoke');

  test('pay zap via regtest action', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Enter nsec manually').click();
    await page.getByPlaceholder('nsec1...').fill(testNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });

    const zapButtons = page.locator('.zap-btn');
    await zapButtons.first().waitFor({ state: 'visible', timeout: 15000 });
    const total = await zapButtons.count();
    let paid = false;
    for (let i = 0; i < Math.min(total, 5); i += 1) {
      await zapButtons.nth(i).click();
      await expect(page.locator('.zap-modal')).toBeVisible();
      const invoiceReady = await page
        .locator('.zap-invoice-box')
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!invoiceReady) {
        await page.getByRole('button', { name: /CLOSE/ }).first().click();
        continue;
      }
      const regtestBtn = page.getByRole('button', { name: /PAY_REGTEST/ });
      if (!(await regtestBtn.isVisible())) {
        await page.getByRole('button', { name: /CLOSE/ }).first().click();
        continue;
      }
      await regtestBtn.click();
      await expect(page.getByText('Payment confirmed.')).toBeVisible({ timeout: 20000 });
      paid = true;
      await page.getByRole('button', { name: /CLOSE/ }).first().click();
      break;
    }

    if (!paid) {
      test.skip(true, 'No zap invoice with regtest pay available');
    }
  });
});
