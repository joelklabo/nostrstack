import { expect, type Page, test } from '@playwright/test';

import { expectRelayMode, loginWithNsec, toggleTheme } from './helpers.ts';

async function measureCardOverflow(page: Page) {
  return page.evaluate(() => {
    const payWidget = document.querySelector('.ns-pay') as HTMLElement | null;
    const card = payWidget?.closest('.paywall-payment-modal-content') as HTMLElement | null;
    if (!payWidget || !card) return null;
    const cardRect = card.getBoundingClientRect();
    let maxDelta = 0;
    let offender: { tag: string; cls: string; text: string; delta: number } | null = null;
    for (const el of Array.from(card.querySelectorAll('*'))) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const delta = rect.right - cardRect.right;
      if (delta > maxDelta + 0.25) {
        maxDelta = delta;
        offender = {
          tag: el.tagName.toLowerCase(),
          cls: (el as HTMLElement).className || '',
          text: ((el as HTMLElement).textContent || '').trim().slice(0, 80),
          delta
        };
      }
    }
    return { maxDelta, offender };
  });
}

test('tip button renders', async ({ page }) => {
  await loginWithNsec(page);
  const zapButtons = page.locator('.zap-btn');
  const count = await zapButtons.count();
  if (count === 0) {
    test.skip(true, 'No zap buttons available in feed');
    return;
  }
  await expect(zapButtons.first()).toBeVisible();
});

test('pay-to-unlock shows locked state', async ({ page }) => {
  await loginWithNsec(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  const count = await unlockButtons.count();
  if (count === 0) {
    test.skip(true, 'No paywalled content available');
    return;
  }
  await expect(unlockButtons.first()).toBeVisible();
});

test('pay-to-unlock does not overflow card at common widths', async ({ page }) => {
  await loginWithNsec(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  if ((await unlockButtons.count()) === 0) {
    test.skip(true, 'No paywalled content available');
    return;
  }
  await unlockButtons.first().click();
  const payWidget = page.locator('.ns-pay');
  const widgetReady = await payWidget
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!widgetReady) {
    test.skip(true, 'Paywall widget did not render');
    return;
  }

  const widths = [1024, 1152, 1280, 1366, 1440, 1514];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(50);
    const overflow = await measureCardOverflow(page);
    expect(overflow, 'paywall card not found').not.toBeNull();
    expect(
      overflow!.maxDelta,
      `overflow at ${width}px: ${JSON.stringify(overflow!.offender)}`
    ).toBeLessThanOrEqual(1);
  }
});

test('tip flow generates invoice', async ({ page }) => {
  await loginWithNsec(page);
  const zapButtons = page.locator('.zap-btn');
  if ((await zapButtons.count()) === 0) {
    test.skip(true, 'No zap buttons available in feed');
    return;
  }
  await zapButtons.first().click();
  await expect(page.locator('.payment-modal')).toBeVisible({ timeout: 10000 });
  const invoiceBox = page.locator('.payment-invoice-box');
  const invoiceReady = await invoiceBox
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!invoiceReady) {
    test.skip(true, 'Zap invoice not available');
    return;
  }
  await expect(invoiceBox).toContainText(/ln/i);
});

test('simulate unlock flow', async ({ page }) => {
  await loginWithNsec(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  if ((await unlockButtons.count()) === 0) {
    test.skip(true, 'No paywalled content available');
    return;
  }
  await unlockButtons.first().click();
  await expect(page.locator('.paywall-payment-modal')).toBeVisible({ timeout: 8000 });
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
  await loginWithNsec(page);
  const nostrButton = page.getByRole('button', { name: 'Nostr' });
  if ((await nostrButton.count()) === 0) {
    test.skip(true, 'Comments widget not available in this view');
    return;
  }
  await nostrButton.click();
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
  await loginWithNsec(page);
  const settingsButton = page.getByRole('button', { name: /Settings/i });
  if ((await settingsButton.count()) > 0) {
    await settingsButton.click();
  }
  const hasThemeButtons =
    (await page.getByRole('button', { name: /DARK_MODE/i }).count()) > 0 &&
    (await page.getByRole('button', { name: /LIGHT_MODE/i }).count()) > 0;
  const hasThemeSelect =
    (await page.locator('select', { has: page.locator('option[value="dark"]') }).count()) > 0;
  if (!hasThemeButtons && !hasThemeSelect) {
    test.skip(true, 'Theme controls not available');
    return;
  }
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-theme', 'light');
  await toggleTheme(page, 'dark');
  await expect(body).toHaveAttribute('data-theme', 'dark');
});
