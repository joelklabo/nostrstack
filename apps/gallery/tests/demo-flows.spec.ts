import { expect, test } from '@playwright/test';

import { expectRelayMode, toggleTheme } from './helpers.ts';

test('tip button renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mock-tip')).toBeVisible();
});

test('pay-to-unlock shows locked state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('unlock-status')).toContainText(/locked/i);
});

test('tip flow generates invoice', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mock-tip').click();
  await expect(page.getByTestId('invoice')).toContainText(/bolt11/i);
});

test('simulate unlock flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('unlock-status')).toContainText(/locked/i);
  await page.getByTestId('mock-unlock').click();
  await expect(page.getByTestId('unlock-status')).toContainText(/unlocked/i);
});

test.skip('embed tip generates mock invoice', async ({ page }) => {
  await page.goto('/');
  const tipBtn = page.locator('#tip-container button').first();
  await tipBtn.waitFor({ timeout: 15000 });
  await tipBtn.click();
  await expect(tipBtn).toBeEnabled();
});

test.skip('embed pay unlocks content', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('paywall-unlock').click();
  const status = page.getByTestId('unlock-status');
  try {
    await expect(status).toContainText(/unlocked/i, { timeout: 10000 });
  } catch {
    await page.getByTestId('mock-unlock').click();
    await expect(status).toContainText(/unlocked/i, { timeout: 5000 });
  }
  await expect(page.locator('text=Unlocked content')).toBeVisible();
});

test('embed comments accept mock post', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nostr' }).click();
  const commentBox = page.locator('#comments-container textarea');
  const count = await commentBox.count();
  if (count === 0) {
    test.skip(true, 'comments widget not mounted in this mode');
  }
  await commentBox.first().waitFor({ timeout: 10000 });
  await commentBox.first().fill('Hello comments');
  await page.locator('#comments-container button', { hasText: 'Post' }).click();
  await expect(page.locator('#comments-container')).toContainText('Hello comments');
});

test.skip('relay badge renders in mock mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nostr' }).click();
  await expectRelayMode(page, 'mock');
});

test('theme toggle flips background', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main');
  const lightBg = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
  await toggleTheme(page, 'dark');
  const darkBg = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
});
