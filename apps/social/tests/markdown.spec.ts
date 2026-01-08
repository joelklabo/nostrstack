import { expect, test } from '@playwright/test';

test.describe('Markdown rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login with nsec
    await page.getByText('Enter nsec manually').click();
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
  });

  test('renders markdown in posts', async ({ page }) => {
    const markdownText = 'Hello **bold** and *italic* and [link](https://example.com)';
    
    // Post a note with markdown
    const editor = page.getByPlaceholder('WHAT ARE YOU HACKING ON?...');
    await editor.fill(markdownText);
    await page.getByText('PUBLISH_EVENT').click();
    
    // Wait for success status
    await expect(page.getByText('SUCCESS: Event published to relays.')).toBeVisible({ timeout: 10000 });

    // Check if it appears in the feed and is rendered
    const postContent = page.locator('.post-content').first();
    await expect(postContent).toContainText('Hello bold and italic and link');
    
    // Verify HTML tags
    const boldText = postContent.locator('strong');
    await expect(boldText).toHaveText('bold');
    
    const italicText = postContent.locator('em');
    await expect(italicText).toHaveText('italic');
    
    const link = postContent.locator('a');
    await expect(link).toHaveAttribute('href', 'https://example.com');
    await expect(link).toHaveText('link');
  });

  test('preserves newlines and autolinks', async ({ page }) => {
    const textWithNewlines = 'Line 1\nLine 2\n\nhttps://google.com';
    
    const editor = page.getByPlaceholder('WHAT ARE YOU HACKING ON?...');
    await editor.fill(textWithNewlines);
    await page.getByText('PUBLISH_EVENT').click();
    
    // Wait for success status
    await expect(page.getByText('SUCCESS: Event published to relays.')).toBeVisible({ timeout: 10000 });

    const postContent = page.locator('.post-content').first();
    
    // Check for <br> or multiple paragraphs
    // markdown-it with breaks:true should use <br> for single newlines or wrap in <p>
    const paragraphs = postContent.locator('p');
    await expect(paragraphs).toHaveCount(2); // One for Line 1/2, one for link
    
    const link = postContent.locator('a');
    await expect(link).toHaveAttribute('href', 'https://google.com');
  });
});
