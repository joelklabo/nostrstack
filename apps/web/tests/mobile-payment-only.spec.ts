import { expect, test } from '@playwright/test';
import { type EventTemplate, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

import { clickAndExpectPaymentModal, closePaymentModal, loginWithNsec, TEST_NSEC } from './helpers';
import { mockLnurlPay } from './helpers/lnurl-mocks';
import { installMockRelay } from './helpers/mock-websocket.ts';

test.describe('mobile payment closure matrix', () => {
  test('payment modal can be opened and closed on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const now = Math.floor(Date.now() / 1000);

    const profileEvent: EventTemplate = {
      kind: 0,
      created_at: now,
      tags: [],
      content: JSON.stringify({
        name: 'Mobile Friend',
        lud16: 'mobile@example.com',
        about: 'test'
      }),
      pubkey,
      pubkey
    };

    const post = finalizeEvent(
      {
        kind: 1,
        created_at: now - 1,
        tags: [],
        content: 'Payment closure mobile regression'
      },
      secretKey
    );

    await installMockRelay(page, [profileEvent, post], {
      zapAddress: 'https://mock.lnurl/lnurlp/test'
    });
    await mockLnurlPay(page, {
      callback: 'https://localhost:4173/mock-lnurl-callback',
      metadataText: 'Payment closure mobile'
    });

    await loginWithNsec(page, TEST_NSEC);

    const firstZap = page.locator('.zap-btn').first();
    await expect(firstZap).toBeVisible({ timeout: 8000 });
    await clickAndExpectPaymentModal(page, firstZap, { force: true });

    const modal = page.locator('.payment-modal').first();
    await expect(modal).toBeVisible({ timeout: 8000 });
    await closePaymentModal(page, modal);

    await expect(modal).toBeHidden({ timeout: 8000 });
    await expect(page.locator('.feed-stream')).toBeVisible({ timeout: 5000 });
  });
});
