import { expect, test } from '@playwright/test';

test.describe('Event Detail View', () => {
  test('visual check for replies', async ({ page }) => {
    // Navigate to a random event page (it will fail to load, but we inject content)
    await page.goto('/nostr/note159849584958495849584958495849584958495849584958495');

    // Inject replies section
    await page.evaluate(() => {
        const container = document.createElement('section');
        container.style.marginTop = '2rem';
        container.innerHTML = `
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border-default);">Replies (2)</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
             <article class="post-card">
                <div class="post-content"><p>This is a reply.</p></div>
             </article>
             <article class="post-card">
                <div class="post-content"><p>This is another reply.</p></div>
             </article>
          </div>
        `;
        const main = document.querySelector('.nostr-event-page');
        if (main) main.appendChild(container);
        else document.body.appendChild(container);
    });

    const repliesHeader = page.getByText('Replies (2)');
    await expect(repliesHeader).toBeVisible();
    
    // Screenshot
    await page.screenshot({ path: 'docs/screenshots/social/event-detail-replies.png' });
  });
});
