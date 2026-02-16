import { expect, type Page, test } from '@playwright/test';

const testNsec =
  process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

const walletPubkey = 'a'.repeat(64);
const secretHex = 'b'.repeat(64);
const relayUrl = 'wss://relay.example';
const nwcUri = `nostr+walletconnect://${walletPubkey}?secret=${secretHex}&relay=${encodeURIComponent(relayUrl)}`;
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

async function loginWithNsec(page: Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(testNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Live Feed/ })).toBeVisible({ timeout: 15000 });
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

  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('NWC_URI').fill(nwcUri);
  await page.getByLabel(/RELAYS/i).fill(relayUrl);
  await page.getByLabel(/MAX_SATS_PER_PAYMENT/i).fill('5000');
  await page.getByRole('button', { name: 'CONNECT', exact: true }).click();
  await expect(page.locator('.nwc-status-pill')).toHaveText(/CONNECTED/);
  await expect(page.getByText(/Balance:/)).toBeVisible();

  await page.getByRole('button', { name: /Feed/i }).click();
  const zapButtons = page.locator('.zap-btn');
  const count = await zapButtons.count();
  if (count === 0) {
    test.skip(true, 'No zap buttons available in feed');
    return;
  }
  await zapButtons.first().click();
  await expect(page.locator('.payment-modal')).toBeVisible();
  await expect(page.getByText('NWC payment sent.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Payment successful!')).toBeVisible();
});

test('invalid NWC URI shows error', async ({ page }) => {
  await loginWithNsec(page);
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('NWC_URI').fill('not-a-uri');
  await expect(page.getByText('NWC URI must start with nostr+walletconnect://')).toBeVisible();
});
