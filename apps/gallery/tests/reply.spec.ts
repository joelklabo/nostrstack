import { expect, test } from '@playwright/test';

test.describe('Reply Flow', () => {
  test('visual check for reply modal', async ({ page }) => {
    await page.goto('/');

    // Inject modal HTML to verify styles
    await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.className = 'reply-modal';
        dialog.open = true;
        dialog.style.padding = '0';
        dialog.style.border = 'none';
        dialog.style.background = 'transparent';
        dialog.style.maxWidth = '100%';
        dialog.style.maxHeight = '100%';
        dialog.style.margin = 'auto';

        dialog.innerHTML = `
            <div class="reply-modal-content" style="background: var(--color-canvas-default); border: 1px solid var(--color-border-default); border-radius: 12px; width: min(600px, 90vw); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <div class="reply-modal-header" style="padding: 1rem; border-bottom: 1px solid var(--color-border-muted); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; fontSize: 1rem;">Reply to note</h3>
                    <button class="action-btn">×</button>
                </div>
                <div style="padding: 1rem;">
                    <div class="post-editor-container">
                        <div class="editor-header">
                            <span class="editor-prompt">[REPLY] &gt;</span> Reply to note:
                        </div>
                        <textarea class="terminal-input editor-input" rows="4" placeholder="Write your reply..."></textarea>
                        <div class="editor-footer">
                            <div class="editor-counter">0 / 1000</div>
                            <div class="editor-actions">
                                <button class="action-btn" style="margin-right: 0.5rem;">CANCEL</button>
                                <button class="auth-btn">PUBLISH_EVENT</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
    });

    await page.waitForTimeout(500);
    const modal = page.locator('.reply-modal');
    await expect(modal).toBeVisible();
    
    // Screenshot
    await page.screenshot({ path: 'docs/screenshots/social/reply-modal.png' });
  });
});