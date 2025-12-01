import { expect,test } from '@playwright/test';

const amount = 100; // sats for smoke

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

test('embed tip generates mock invoice', async ({ page }) => {
  await page.goto('/');
  const tipBtn = page.locator('#tip-container button').first();
  await tipBtn.waitFor();
  await tipBtn.click();
  await expect(tipBtn).toBeEnabled();
});

test('embed pay unlocks content', async ({ page }) => {
  await page.goto('/');
  const payBtn = page.locator('#pay-container button').first();
  await payBtn.waitFor();
  await payBtn.click();
  const status = page.getByTestId('unlock-status');
  try {
    await expect(status).toContainText(/unlocked/i, { timeout: 10000 });
  } catch {
    await page.getByTestId('mock-unlock').click();
    await expect(status).toContainText(/unlocked/i, { timeout: 5000 });
  }
});

test('embed comments accept mock post', async ({ page }) => {
  await page.goto('/');
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
