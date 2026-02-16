import { expect, test } from '@playwright/test';
import type { Event } from 'nostr-tools';

import { loginWithNsec, seedMockEvent } from './helpers';

const walletPubkey = 'a'.repeat(64);
const secretHex = 'b'.repeat(64);
const relayUrl = 'wss://relay.example';
const nwcUri = `nostr+walletconnect://${walletPubkey}?secret=${secretHex}&relay=${encodeURIComponent(relayUrl)}`;
const seededZapPost: Event = {
  id: 'nwc-zap-post-001',
  pubkey: 'c'.repeat(64),
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Deterministic zap flow fixture',
  sig: 'd'.repeat(128)
};
const lnurlMetadata = {
  tag: 'payRequest',
  callback: 'https://mock.lnurl/callback',
  minSendable: 1000,
  maxSendable: 100000000,
  metadata: JSON.stringify([['text/plain', 'Zap test']])
};

declare global {
  interface Window {
    __NOSTRSTACK_NWC_MOCK__?: {
      getBalance: () => Promise<{ balance: number }>;
      payInvoice: (invoice: string) => Promise<void>;
    };
    __NOSTRSTACK_ZAP_ADDRESS__?: string;
  }
}

test('connects NWC and pays zap via mock', async ({ page }) => {
  await page.addInitScript(() => {
    window.__NOSTRSTACK_NWC_MOCK__ = {
      getBalance: async () => ({ balance: 21000 }),
      payInvoice: async () => undefined
    };
    window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
  });

  await page.route('**/lnurlp/test', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lnurlMetadata)
    });
  });
  await page.route('**/callback*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc1mockinvoice' })
    });
  });

  await loginWithNsec(page);
  await seedMockEvent(page, seededZapPost);
  await page.getByRole('button', { name: /Feed/i }).click();

  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('Connection String').fill(nwcUri);
  await page.getByPlaceholder('wss://relay.example, wss://relay2.example').fill(relayUrl);
  await page.getByLabel(/Max Payment/i).fill('5000');
  await page.getByRole('button', { name: 'Connect to NWC wallet' }).click();
  await expect(page.locator('.nwc-status-pill')).toHaveText(/CONNECTED/);
  await expect(page.getByText(/Balance:/)).toBeVisible();

  await page.getByRole('button', { name: /Feed/i }).click();
  const zapButtons = page.locator('.zap-btn');
  await expect(
    zapButtons.first(),
    'Expected a seeded zap button from deterministic fixture'
  ).toBeVisible({
    timeout: 15000
  });
  const tourSkip = page.getByRole('button', { name: 'Skip tour' });
  if (await tourSkip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tourSkip.click();
  }
  await zapButtons.first().scrollIntoViewIfNeeded();
  await zapButtons.first().click({ force: true });
  await expect(page.locator('.payment-modal')).toBeVisible();
  await expect(page.getByText('NWC payment sent.')).toBeVisible({ timeout: 15000 });
});

test('invalid NWC URI shows error', async ({ page }) => {
  await loginWithNsec(page);
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('Connection String').fill('not-a-uri');
  await expect(page.getByText('NWC URI must start with nostr+walletconnect://')).toBeVisible();
});
