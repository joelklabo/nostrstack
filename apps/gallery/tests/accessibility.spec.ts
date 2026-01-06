import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Accessibility', () => {
  test('FeedView should not have any automatically detectable accessibility issues', async ({
    page
  }) => {
    await page.goto('/');

    // Wait for content to load (mock relays should be fast)
    await page.waitForSelector('main[role="main"]');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Navigation via keyboard should be possible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main[role="main"]');

    // Press Tab to focus first element
    await page.keyboard.press('Tab');

    // Check if something is focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).not.toBe('BODY');
  });
});
