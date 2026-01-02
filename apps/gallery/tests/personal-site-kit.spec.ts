import { expect, test } from '@playwright/test';

test.describe('Personal Site Kit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to gallery and login if needed
    await page.goto('/personal-site-kit');
    // If we are redirected to login, we might need to handle it, but usually the dev env has a guest session or we can skip it.
    // Assuming we can reach /personal-site-kit if logged in or if it's public in the demo.
  });

  test('renders all personal site kit components', async ({ page }) => {
    await expect(page.getByText('Personal Site Kit Demo')).toBeVisible();
    
    // Check SupportSection
    await expect(page.getByText('SupportSection (Full Layout)')).toBeVisible();
    await expect(page.getByText('Support this post')).toBeVisible();
    
    // Check TipWidget inside SupportSection
    // Since it's an iframe or mounted via embed, we check for its presence
    await expect(page.locator('[data-nostrstack-tip-widget]').first()).toBeVisible();
    
    // Check ShareButton inside SupportSection
    await expect(page.locator('[data-nostrstack-share-button]').first()).toBeVisible();
    
    // Check Comments inside SupportSection
    await expect(page.locator('[data-nostrstack-comments]').first()).toBeVisible();
    
    // Check Compact layout
    await expect(page.getByText('SupportSection (Compact Layout)')).toBeVisible();
    
    // Check CommentTipWidget (Embed wrapper)
    await expect(page.getByText('CommentTipWidget (Embed Wrapper)')).toBeVisible();
    await expect(page.locator('[data-nostrstack-comment-tip-widget]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'docs/screenshots/personal-site-kit/demo-view.png', fullPage: true });
  });
});
