import { expect, type Page } from '@playwright/test';

export async function setRelays(page: Page, relaysCsv: string) {
  const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
  await relayInput.waitFor({ timeout: 5000 });
  await relayInput.fill(relaysCsv);
}

export async function enableTestSigner(page: Page) {
  const toggle = page.getByLabel(/Built-in Nostr test signer/i);
  if ((await toggle.count()) === 0) return;
  if (!(await toggle.isChecked())) {
    await toggle.check();
  }
}

export async function expectRelayMode(page: Page, mode: 'real' | 'mock') {
  const selector = mode === 'real' ? '#relay-status .dot.real' : '#relay-status .dot.mock';
  // If mock indicator missing, force relays input to mock and retry.
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout: 12000 });
  } catch (err) {
    if (mode === 'mock') {
      const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
      await relayInput.fill('mock');
      await page.waitForTimeout(300); // allow remount
      await expect(page.locator(selector)).toBeVisible({ timeout: 12000 });
    } else {
      throw err;
    }
  }
}

export async function postComment(page: Page, text: string) {
  const textarea = page.locator('#comments-container textarea').first();
  await textarea.waitFor({ timeout: 10000 });
  await textarea.fill(text);
  await page.locator('#comments-container button', { hasText: 'Post' }).first().click();
}

export async function toggleTheme(page: Page, theme: 'light' | 'dark') {
  const select = page.locator('select').first();
  await select.selectOption(theme);
}
