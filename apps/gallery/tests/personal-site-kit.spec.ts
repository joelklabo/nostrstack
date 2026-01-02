import { expect, test } from '@playwright/test';

import { resolveDocScreenshotPath } from './helpers.ts';

test.describe('Personal Site Kit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to gallery and login if needed
    await page.goto('/personal-site-kit');
    // If we are redirected to login, we might need to handle it, but usually the dev env has a guest session or we can skip it.
    // Assuming we can reach /personal-site-kit if logged in or if it's public in the demo.
  });

  test('renders all personal site kit components', async ({ page }) => {
    await expect(page.getByText('Personal Site Kit Demo')).toBeVisible();
    
    // Blockchain Stats
    const stats = page.locator('[data-nostrstack-blockchain]');
    await expect(stats).toBeVisible();
    await stats.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/blockchain-stats.png') });

    // Nostr Profile
    const profile = page.locator('[data-nostrstack-profile]');
    await expect(profile).toBeVisible();
    await profile.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/nostr-profile.png') });

    // Check SupportSection
    await expect(page.getByText('SupportSection (Full Layout)')).toBeVisible();
    const supportFull = page.locator('section').filter({ hasText: 'SupportSection (Full Layout)' });
    await supportFull.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/support-section.png') });
    
    // Check TipWidget inside SupportSection
    const tipWidget = page.locator('[data-nostrstack-tip-widget]').first();
    await expect(tipWidget).toBeVisible();
    await tipWidget.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/tip-widget.png') });
    
    // Check ShareButton inside SupportSection
    const shareBtn = page.locator('[data-nostrstack-share-button]').first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/share-button.png') });
    
    // Check Comments inside SupportSection
    const comments = page.locator('[data-nostrstack-comments]').first();
    await expect(comments).toBeVisible();
    await comments.screenshot({ path: resolveDocScreenshotPath('personal-site-kit/comments.png') });
    
    // Check Compact layout
    await expect(page.getByText('SupportSection (Compact Layout)')).toBeVisible();
    
    // Check CommentTipWidget (Embed wrapper)
    await expect(page.getByText('CommentTipWidget (Embed Wrapper)')).toBeVisible();
    const commentTipWrapper = page.locator('[data-nostrstack-comment-tip-widget]');
    await expect(commentTipWrapper).toBeVisible();
    await commentTipWrapper.screenshot({
      path: resolveDocScreenshotPath('personal-site-kit/comment-tip-widget-wrapper.png')
    });
    
    // Take full page screenshot
    await page.screenshot({
      path: resolveDocScreenshotPath('personal-site-kit/personal-site-kit-view.png'),
      fullPage: true
    });
  });
});
