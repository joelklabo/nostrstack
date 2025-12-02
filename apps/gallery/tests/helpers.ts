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
  await expect(page.locator(selector)).toBeVisible({ timeout: 10000 });
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
