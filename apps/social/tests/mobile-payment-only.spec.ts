import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

import { clickAndExpectPaymentModal, loginWithNsec, TEST_NSEC } from './helpers';
import { mockLnurlPay } from './helpers/lnurl-mocks';
import { installMockRelay } from './helpers/mock-websocket.ts';

test.describe('mobile payment closure matrix', () => {
  test('payment modal can be opened and closed on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const now = Math.floor(Date.now() / 1000);

    const profileEvent = {
      kind: 0,
      created_at: now,
      tags: [],
      content: JSON.stringify({
        name: 'Mobile Friend',
        lud16: 'mobile@example.com',
        about: 'test'
      }),
      pubkey,
      id: pubkey,
      sig: '0'.repeat(128)
    } as any;

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
    const closeButton = page.getByRole('button', { name: /CLOSE/i }).first();
    await closeButton.click({ timeout: 5000 });

    await expect(modal).toBeHidden({ timeout: 8000 });
    await expect(page.locator('.feed-stream')).toBeVisible({ timeout: 5000 });
  });
});
