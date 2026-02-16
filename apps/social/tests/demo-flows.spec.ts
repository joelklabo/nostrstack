import { expect, type Page, test } from '@playwright/test';

import { expectRelayMode, loginWithNsec, toggleTheme } from './helpers.ts';
import { mockLnurlPay } from './helpers/lnurl-mocks.ts';

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

async function ensureZapPost(page: Page) {
  const zapButtons = page.locator('.zap-btn');
  if ((await zapButtons.count()) > 0) {
    return;
  }

  const writeFirstPostButton = page.getByRole('button', { name: 'Write your first post' });
  if (await writeFirstPostButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await writeFirstPostButton.click();
  }

  const noteInput = page.getByRole('textbox', { name: 'Note content' });
  await expect(noteInput).toBeVisible({ timeout: 10000 });
  await noteInput.fill(`Playwright tip fixture ${Date.now()}`);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(zapButtons.first(), 'Expected seeded zap post to appear after publish').toBeVisible({
    timeout: 20000
  });
}

async function dismissTourIfOpen(page: Page) {
  const tourControls = [
    page.getByRole('button', { name: 'Skip tour' }),
    page.getByRole('button', { name: 'Dismiss tour' }),
    page.getByRole('button', { name: 'Go to next step' })
  ];

  for (const control of tourControls) {
    if (await control.isVisible({ timeout: 1000 }).catch(() => false)) {
      await control.click().catch(() => undefined);
      return;
    }
  }
}

test('tip button renders', async ({ page }) => {
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  await ensureZapPost(page);
  const zapButtons = page.locator('.zap-btn');
  const count = await zapButtons.count();
  expect(count, 'No zap buttons available in feed').toBeGreaterThan(0);
  await expect(zapButtons.first()).toBeVisible();
});

test('pay-to-unlock shows locked state', async ({ page }) => {
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  const count = await unlockButtons.count();
  expect(count, 'No paywalled content available').toBeGreaterThan(0);
  await expect(unlockButtons.first()).toBeVisible();
});

test('pay-to-unlock does not overflow card at common widths', async ({ page }) => {
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  expect(await unlockButtons.count(), 'No paywalled content available').toBeGreaterThan(0);
  await unlockButtons.first().click();
  const payWidget = page.locator('.ns-pay');
  await expect(payWidget, 'Paywall widget did not render').toBeVisible({ timeout: 8000 });

  const widths = [1024, 1152, 1280, 1366, 1440, 1514];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await measureCardOverflow(page);
    expect(overflow, 'paywall card not found').not.toBeNull();
    expect(
      overflow!.maxDelta,
      `overflow at ${width}px: ${JSON.stringify(overflow!.offender)}`
    ).toBeLessThanOrEqual(1);
  }
});

test('tip flow generates invoice', async ({ page }) => {
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.addInitScript(() => {
    window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
  });
  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright demo flow tip'
  });
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  await ensureZapPost(page);
  await dismissTourIfOpen(page);
  const zapButtons = page.locator('.zap-btn');
  expect(await zapButtons.count(), 'No zap buttons available in feed').toBeGreaterThan(0);
  await zapButtons.first().scrollIntoViewIfNeeded();
  await zapButtons.first().click({ force: true });
  await page.waitForTimeout(1000);
  if (failedRequests.length > 0) {
    throw new Error(`Request failures while initiating zap: ${failedRequests.join(', ')}`);
  }
  await expect(page.locator('.payment-modal')).toBeVisible({ timeout: 10000 });
  const invoiceBox = page.locator('.payment-invoice-box');
  await expect(invoiceBox, 'Zap invoice not available').toBeVisible({ timeout: 8000 });
  await expect(invoiceBox).toContainText(/ln/i);

  expect(failedRequests).toEqual([]);
});

test('simulate unlock flow', async ({ page }) => {
  await loginWithNsec(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  expect(await unlockButtons.count(), 'No paywalled content available').toBeGreaterThan(0);
  await unlockButtons.first().click();
  await expect(page.locator('.paywall-payment-modal')).toBeVisible({ timeout: 8000 });
});

test('embed tip generates mock invoice', async ({ page }) => {
  await page.goto('/');
  const supportCard = page.getByRole('region', { name: 'Support Nostrstack' });
  const devSupportBtn = page.getByRole('button', { name: 'Copy env template to clipboard' });
  const sendSatsBtn = page.getByRole('button', { name: /Support Nostrstack with a zap/i });

  if (!(await supportCard.isVisible({ timeout: 1000 }).catch(() => false))) {
    return;
  }

  if (await sendSatsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await expect(sendSatsBtn, 'Mock tip control missing in embed flow').toBeEnabled();
    await sendSatsBtn.click();
    await expect(page.locator('.payment-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.payment-invoice-box')).toBeVisible({ timeout: 8000 });
    return;
  }

  await expect(devSupportBtn, 'Mock tip setup fallback missing in embed flow').toBeVisible({
    timeout: 15000
  });
  await expect(devSupportBtn, 'Mock tip setup control disabled').toBeEnabled();
});

test('embed pay unlocks content', async ({ page }) => {
  await page.goto('/');
  const paywallButton = page.getByTestId('paywall-unlock');
  await expect(paywallButton, 'Mock paywall action not present').toBeVisible({ timeout: 15000 });
  await paywallButton.click();
  const status = page.getByTestId('unlock-status');
  await expect(status, 'Unlock status indicator missing').toBeVisible({ timeout: 10000 });
  await expect(status).toContainText(/unlocked/i, { timeout: 10000 });
  await expect(page.locator('text=Unlocked content')).toBeVisible();
});

test('embed comments accept mock post', async ({ page }) => {
  await loginWithNsec(page);
  const nostrButton = page.getByRole('button', { name: 'Nostr' });
  expect(await nostrButton.count(), 'Comments widget not available in this view').toBeGreaterThan(
    0
  );
  await nostrButton.click();
  const commentBox = page.locator('#comments-container textarea');
  const count = await commentBox.count();
  expect(count, 'comments widget not mounted in this mode').toBeGreaterThan(0);
  await commentBox.first().waitFor({ timeout: 10000 });
  await commentBox.first().fill('Hello comments');
  await page.locator('#comments-container button', { hasText: 'Post' }).click();
  await expect(page.locator('#comments-container')).toContainText('Hello comments');
});

test('relay badge renders in mock mode', async ({ page }) => {
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
  expect(!hasThemeButtons && !hasThemeSelect, 'Theme controls not available').toBe(false);
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-theme', 'light');
  await toggleTheme(page, 'dark');
  await expect(body).toHaveAttribute('data-theme', 'dark');
});
