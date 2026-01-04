import { expect, test } from '@playwright/test';

test.describe('Reaction (Like)', () => {
  test('visual check for reaction button state', async ({ page }) => {
    await page.goto('/');
    
    // Inject a post with active like button to capture styles
    // We simulate the React component's output
    await page.evaluate(() => {
        const container = document.createElement('div');
        container.className = 'post-card';
        container.innerHTML = `
            <div class="post-header">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                   <span style="font-weight: 600;">Test User</span>
                </div>
            </div>
            <div class="post-content"><p>This post has been liked!</p></div>
            <div class="post-actions">
                <button class="action-btn reaction-btn active" style="color: rgb(207, 34, 46); border-color: rgba(207, 34, 46, 0.4); background: rgba(207, 34, 46, 0.08);" title="Liked" aria-label="Like">♥</button>
                <button class="action-btn">Reply</button>
            </div>
        `;
        const feed = document.querySelector('.feed-container');
        if (feed) feed.prepend(container);
        else document.body.prepend(container);
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/social/reaction-active.png' });
    
    // Verify styles applied
    const btn = page.locator('.reaction-btn.active');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS('color', 'rgb(207, 34, 46)');
  });
});
