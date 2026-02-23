import { expect, test } from '@playwright/test';

test.describe('Markdown rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login with nsec
    await page.getByText('Enter nsec manually').click();
    const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await page.getByPlaceholder('nsec1...').fill(validNsec);
    await page.getByRole('button', { name: 'Sign in with private key' }).click();
    await expect(page.getByRole('heading', { name: /Live Feed/ })).toBeVisible({ timeout: 15000 });

    // Wait for feed to load initial posts
    await expect(page.locator('[data-testid="web-event-content"]').first()).toBeVisible({
      timeout: 10000
    });
  });

  test('renders markdown in posts', async ({ page }) => {
    const markdownText = 'Hello **bold** and *italic* and [link](https://example.com)';

    // Post a note with markdown
    const editor = page.getByPlaceholder('Share something with the network...');
    await editor.fill(markdownText);
    await page.getByRole('button', { name: 'Publish note' }).click();

    // Wait for success status
    await expect(page.getByText('Success: Event published to relays.')).toBeVisible({
      timeout: 10000
    });

    // Wait for the feed to potentially update
    await page.waitForTimeout(2000);

    // Look for a post containing the markdown content
    // Use a locator that searches for posts containing the text
    const postContent = page
      .locator('[data-testid="web-event-content"]')
      .filter({
        hasText: /Hello bold and italic and link/
      })
      .first();

    // Wait for the post to appear
    await expect(postContent).toBeVisible({ timeout: 10000 });

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

    const editor = page.getByPlaceholder('Share something with the network...');
    await editor.fill(textWithNewlines);
    await page.getByRole('button', { name: 'Publish note' }).click();

    // Wait for success status
    await expect(page.getByText('Success: Event published to relays.')).toBeVisible({
      timeout: 10000
    });

    // Wait for the feed to potentially update
    await page.waitForTimeout(2000);

    // Look for a post containing the text (use more flexible matching)
    const postContent = page
      .locator('[data-testid="web-event-content"]')
      .filter({
        hasText: /Line/
      })
      .filter({
        hasText: /google\.com/
      })
      .first();

    // Wait for the post to appear
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Check for <br> or multiple paragraphs
    // markdown-it with breaks:true should use <br> for single newlines or wrap in <p>
    const paragraphs = postContent.locator('p');
    await expect(paragraphs).toHaveCount(2); // One for Line 1/2, one for link

    const link = postContent.locator('a');
    await expect(link).toHaveAttribute('href', 'https://google.com');
  });
});
