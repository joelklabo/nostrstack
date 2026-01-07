import { test } from '@playwright/test';

test('capture prod screenshot', async ({ page }) => {
  await page.goto('https://nostrstack.com');
  await page.waitForTimeout(2000); // Wait for animations
  await page.screenshot({ path: 'prod-screenshot.png', fullPage: true });
});
