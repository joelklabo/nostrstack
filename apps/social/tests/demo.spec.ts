import { expect, test } from '@playwright/test';

import { resolveDocScreenshotPath } from './helpers.ts';

test.describe('Widget Demos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo');
  });

  test('renders all demo components', async ({ page }) => {
    await expect(page.getByText('Widget Demos')).toBeVisible();

    // Blockchain Stats
    const stats = page.locator('[data-nostrstack-blockchain]');
    await expect(stats).toBeVisible();
    await stats.screenshot({ path: resolveDocScreenshotPath('demo/blockchain-stats.png') });

    // Nostr Profile
    const profile = page.locator('[data-nostrstack-profile]');
    await expect(profile).toBeVisible();
    await profile.screenshot({ path: resolveDocScreenshotPath('demo/nostr-profile.png') });

    // Check SupportSection
    await expect(page.getByText('SupportSection (Full Layout)')).toBeVisible();
    const supportFull = page.locator('section').filter({ hasText: 'SupportSection (Full Layout)' });
    await supportFull.screenshot({ path: resolveDocScreenshotPath('demo/support-section.png') });

    // Check TipWidget inside SupportSection
    const tipWidget = page.locator('[data-nostrstack-tip-widget]').first();
    await expect(tipWidget).toBeVisible();
    await tipWidget.screenshot({ path: resolveDocScreenshotPath('demo/tip-widget.png') });

    // Check ShareButton inside SupportSection
    const shareBtn = page.locator('[data-nostrstack-share-button]').first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.screenshot({ path: resolveDocScreenshotPath('demo/share-button.png') });

    // Check Comments inside SupportSection
    const comments = page.locator('[data-nostrstack-comments]').first();
    await expect(comments).toBeVisible();
    await comments.screenshot({ path: resolveDocScreenshotPath('demo/comments.png') });

    // Check Compact layout
    await expect(page.getByText('SupportSection (Compact Layout)')).toBeVisible();

    // Check CommentTipWidget (Embed wrapper)
    await expect(page.getByText('CommentTipWidget (Embed Wrapper)')).toBeVisible();
    const commentTipWrapper = page.locator('[data-nostrstack-comment-tip-widget]');
    await expect(commentTipWrapper).toBeVisible();
    await commentTipWrapper.screenshot({
      path: resolveDocScreenshotPath('demo/comment-tip-widget-wrapper.png')
    });

    // Take full page screenshot
    await page.screenshot({
      path: resolveDocScreenshotPath('demo/demo-view.png'),
      fullPage: true
    });
  });
});
