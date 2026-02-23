import { test } from '@playwright/test';

test('capture prod screenshot', async ({ page }) => {
  await page.goto('https://nostrstack.com');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'prod-screenshot.png', fullPage: true });
});
