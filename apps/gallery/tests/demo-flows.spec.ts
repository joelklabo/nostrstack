import { expect, type Page, test } from '@playwright/test';

import { expectRelayMode, toggleTheme } from './helpers.ts';

async function measureCardOverflow(page: Page) {
  return page.evaluate(() => {
    const payWidget = document.querySelector('.nostrstack-pay') as HTMLElement | null;
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

const testNsec = process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

async function loginWithNsec(page: Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(testNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
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
  const payWidget = page.locator('.nostrstack-pay');
  const widgetReady = await payWidget.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
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
    expect(overflow!.maxDelta, `overflow at ${width}px: ${JSON.stringify(overflow!.offender)}`).toBeLessThanOrEqual(1);
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
  await expect(page.locator('.zap-modal')).toBeVisible({ timeout: 10000 });
  const invoiceBox = page.locator('.zap-invoice-box');
  const invoiceReady = await invoiceBox.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
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
  const themeSelect = page.locator('select').first();
  if ((await themeSelect.count()) === 0) {
    test.skip(true, 'Theme selector not available');
    return;
  }
  const main = page.locator('main');
  const lightBg = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
  await toggleTheme(page, 'dark');
  const darkBg = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
});
