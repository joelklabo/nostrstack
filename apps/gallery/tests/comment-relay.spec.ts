import { expect, test } from '@playwright/test';

const RELAY = process.env.REAL_RELAY ?? 'wss://relay.damus.io';

// Opt-in: requires a NIP-07 signer available in the browser profile running Playwright.
// Run with: REAL_RELAY=wss://relay.damus.io pnpm --filter gallery exec playwright test tests/comment-relay.spec.ts

test.describe('real relay comment', () => {
  test('posts when signer is available', async ({ page }) => {
    await page.goto('/');
    const hasSigner = await page.evaluate(() => {
      const w = window as unknown as { nostr?: { signEvent?: unknown } };
      return typeof w.nostr?.signEvent === 'function';
    });
    test.skip(!hasSigner, 'No NIP-07 signer available in browser');

    // Set relay to single real relay
    const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
    await relayInput.fill(RELAY);

    // Post a comment
    const textarea = page.locator('#comments-container textarea').first();
    await textarea.waitFor({ timeout: 5000 });
    const msg = `playwright real relay ${Date.now()}`;
    await textarea.fill(msg);
    await page.locator('#comments-container button', { hasText: 'Post' }).first().click();

    // Expect it to appear locally; relay status should reflect real mode
    await expect(page.locator('#comments-container')).toContainText(msg, { timeout: 10000 });
    await expect(page.locator('#relay-status')).toContainText('real', { timeout: 5000 });
  });
});
