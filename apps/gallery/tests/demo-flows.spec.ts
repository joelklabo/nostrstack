import { test, expect } from '@playwright/test';

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
