import { expect, type Page, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { clickAndExpectPaymentModal, closePaymentModal, loginWithNsec } from './helpers';
import { mockLnurlPay } from './helpers/lnurl-mocks';
import { installMockRelay } from './helpers/mock-websocket.ts';

const secretKey = generateSecretKey();
const friendPubkey = getPublicKey(secretKey);
const friendNpub = nip19.npubEncode(friendPubkey);
const now = Math.floor(Date.now() / 1000);

const profileEvent = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [],
    content: JSON.stringify({
      name: 'Lightning Friend',
      lud16: 'sats@example.com',
      about: 'Test profile with lightning address'
    })
  },
  secretKey
);

const postEvents = [
  finalizeEvent(
    {
      kind: 1,
      created_at: now - 10,
      tags: [],
      content: 'First zapgable post'
    },
    secretKey
  ),
  finalizeEvent(
    {
      kind: 1,
      created_at: now - 5,
      tags: [],
      content: 'Second zapgable post'
    },
    secretKey
  )
];

function isKnownConsoleError(message: string) {
  const ignore = [
    /An SSL certificate error occurred when fetching the script/i,
    /Failed to load resource: the server responded with a status of 404/i,
    /Failed to load resource: net::ERR_CONNECTION_REFUSED/i,
    /ERR_CERT_COMMON_NAME_INVALID/i,
    /ERR_NAME_NOT_RESOLVED/i
  ];
  return ignore.some((pattern) => pattern.test(message));
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

test('find friend and tip flow', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isKnownConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await installMockRelay(page, [profileEvent, ...postEvents], {
    zapAddress: 'https://mock.lnurl/lnurlp/test'
  });
  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright friend tip'
  });
  await loginWithNsec(page);
  await dismissTourIfOpen(page);

  await page.click('text=Find friend');
  await page.screenshot({ path: 'test-results/debug-search-nav.png' });
  await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('Search query').fill(friendNpub);
  await page.getByRole('button', { name: 'Search' }).click();
  const openProfile = page.getByRole('button', { name: 'Open profile' });
  await expect(openProfile).toBeVisible({ timeout: 10_000 });
  await openProfile.click();

  await expect(page.getByText('Lightning Friend').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Tip 500 sats/i)).toBeVisible();

  const zapButtons = page.locator('.zap-btn');
  const zapCount = await zapButtons.count();
  expect(zapCount, 'Expected at least one zap button for friend-tip coverage').toBeGreaterThan(0);

  const targetZapCount = Math.min(zapCount, 2);
  for (let index = 0; index < targetZapCount; index++) {
    await zapButtons.nth(index).scrollIntoViewIfNeeded();
    await clickAndExpectPaymentModal(page, zapButtons.nth(index));
    const modal = page.locator('.payment-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10_000 });
    await closePaymentModal(page, modal);
  }

  const sendButton = page.getByRole('button', { name: /SEND 500/i });
  if ((await sendButton.count()) > 0) {
    await expect(sendButton.first(), 'Send 500 button was not visible').toBeVisible({
      timeout: 15_000
    });
    await sendButton.first().scrollIntoViewIfNeeded();
    await clickAndExpectPaymentModal(page, sendButton.first());
    const sendModal = page.locator('.payment-modal');
    await expect(sendModal).toBeVisible({ timeout: 10_000 });
    await expect(sendModal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10_000 });
    await closePaymentModal(page, sendModal);
  } else {
    const profileZapFallback = page.locator('.zap-btn');
    const fallbackCount = await profileZapFallback.count();
    if (fallbackCount > 0) {
      await profileZapFallback.first().scrollIntoViewIfNeeded();
      await clickAndExpectPaymentModal(page, profileZapFallback.first());
      const fallbackModal = page.locator('.payment-modal');
      await expect(fallbackModal).toBeVisible({ timeout: 10_000 });
      await expect(fallbackModal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10_000 });
      await closePaymentModal(page, fallbackModal);
    }
  }

  expect(consoleErrors).toEqual([]);
});
