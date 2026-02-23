import { expect, test } from '@playwright/test';

import { loginWithNsec } from './helpers.ts';

const VALID_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('Reaction (Like)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    
    // Mock Bitcoin status API
    await page.route('**/api/bitcoin/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          network: 'regtest',
          blocks: 100,
          headers: 100,
          bestblockhash: '0000',
          difficulty: 1,
          mediantime: Math.floor(Date.now() / 1000),
          verificationprogress: 1,
          chainwork: '0000',
          size_on_disk: 1000,
          pruned: false,
          mempool: {
            size: 10,
            bytes: 1000,
            usage: 2000,
            total_fee: 0.001,
            maxmempool: 300000000,
            mempoolminfee: 0.00001,
            minrelaytxfee: 0.00001
          },
          lightning: {
            status: 'ok',
            provider: 'mock'
          }
        })
      });
    });
  });

  test('user can like a post', async ({ page }) => {
    await loginWithNsec(page, VALID_NSEC);
    
    // Wait for posts to load
    await expect(page.locator('[data-testid="web-event-card"]').first()).toBeVisible({
      timeout: 15000
    });
    
    const firstPost = page.locator('[data-testid="web-event-card"]').first();
    const likeBtn = firstPost.locator('[data-testid="web-event-reaction"]').first();
    
    // Click like
    await likeBtn.click();
    
    // Verify optimistic UI (active class)
    await expect(likeBtn).toHaveClass(/active/, { timeout: 10000 });
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
  });
});
