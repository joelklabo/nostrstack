import type { Page } from '@playwright/test';

type LnurlMockOptions = {
  callback?: string;
  invoice?: string;
  minSendable?: number;
  maxSendable?: number;
  commentAllowed?: number;
  metadataText?: string;
};

export async function mockLnurlPay(page: Page, options: LnurlMockOptions = {}) {
  const callback = options.callback ?? 'https://mock.lnurl/callback';
  const metadata = {
    tag: 'payRequest',
    callback,
    minSendable: options.minSendable ?? 1000,
    maxSendable: options.maxSendable ?? 100000000,
    metadata: JSON.stringify([["text/plain", options.metadataText ?? 'Mock LNURL pay']]),
    commentAllowed: options.commentAllowed ?? 120,
  };
  const invoice = options.invoice ?? 'lnbc1mockinvoice';
  const callbackPath = new URL(callback).pathname;

  await page.route('**/.well-known/lnurlp/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(metadata),
    });
  });

  await page.route('**/lnurlp/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(metadata),
    });
  });

  await page.route(`**${callbackPath}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: invoice }),
    });
  });
}
