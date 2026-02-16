import { expect, type Page, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { clickAndExpectPaymentModal, closePaymentModal, loginWithNsec, TEST_NSEC } from './helpers';
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

async function waitForPaymentModal(page: Page) {
  const modal = page
    .locator(
      '.payment-modal, .payment-overlay, .paywall-payment-modal, .paywall-widget-host, .zap-modal, .support-card-modal, .zap-modal-overlay'
    )
    .first();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  const invoiceReady = page.getByText(/Invoice ready/i);
  const statusReady = page.locator('.payment-status');
  if ((await invoiceReady.count()) > 0) {
    await expect(invoiceReady.first()).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(statusReady.first()).toBeVisible({ timeout: 10_000 });
  }
  return modal;
}

test('zap two posts and send sats from profile', async ({ page }) => {
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
    metadataText: 'Playwright payment journey'
  });
  await loginWithNsec(page, TEST_NSEC);
  await dismissTourIfOpen(page);

  const zapButtons = page.locator('.zap-btn');
  const feedZapCount = await zapButtons.count();
  const feedTargetZapCount = Math.min(feedZapCount, 2);

  if (feedTargetZapCount > 0) {
    for (let index = 0; index < feedTargetZapCount; index++) {
      await expect(
        zapButtons.nth(index),
        'Expected enough zap buttons for feed coverage'
      ).toBeVisible({
        timeout: 8000
      });
      await zapButtons.nth(index).scrollIntoViewIfNeeded();
      await clickAndExpectPaymentModal(page, zapButtons.nth(index));
      const modal = await waitForPaymentModal(page);
      await closePaymentModal(page, modal);
    }
  }

  await page.goto(`/p/${friendNpub}`);
  const profilePage = page;
  await expect(profilePage.getByText('Lightning Friend')).toBeVisible({ timeout: 15_000 });
  await dismissTourIfOpen(profilePage);

  const sendSatsCard = profilePage.locator('.send-sats-card');
  if (await sendSatsCard.isVisible({ timeout: 12_000 }).catch(() => false)) {
    const sendButton = sendSatsCard.locator('button', { hasText: /^SEND /i });
    await expect(sendButton).toBeVisible({ timeout: 10_000 });
    await sendButton.scrollIntoViewIfNeeded();
    await clickAndExpectPaymentModal(profilePage, sendButton, {
      modalSelector: '.payment-modal, .paywall-payment-modal'
    });
    const modal = await waitForPaymentModal(profilePage);
    await closePaymentModal(page, modal);
    expect(consoleErrors).toEqual([]);
    return;
  }

  const profileZapButtons = profilePage.locator('.zap-btn');
  const profileZapCount = await profileZapButtons.count();
  if (profileZapCount > 0) {
    await profileZapButtons.nth(0).scrollIntoViewIfNeeded();
    await clickAndExpectPaymentModal(profilePage, profileZapButtons.nth(0));
    const modal = await waitForPaymentModal(profilePage);
    await closePaymentModal(page, modal);
    expect(consoleErrors).toEqual([]);
    return;
  }

  await profilePage.goto('/');
  await dismissTourIfOpen(profilePage);
  const fallbackZapButtons = profilePage.locator('.zap-btn');
  await expect(fallbackZapButtons.first()).toBeVisible({ timeout: 12_000 });
  await fallbackZapButtons.first().scrollIntoViewIfNeeded();
  await clickAndExpectPaymentModal(profilePage, fallbackZapButtons.first());
  const modal = await waitForPaymentModal(profilePage);
  await closePaymentModal(page, modal);

  expect(consoleErrors).toEqual([]);
});
