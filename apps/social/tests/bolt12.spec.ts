import { expect, test } from '@playwright/test';

const TEST_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((nsec) => {
    localStorage.setItem('nostrstack.auth.mode', 'nsec');
    localStorage.setItem('nostrstack.auth.nsec', nsec);
  }, TEST_NSEC);

  await page.addInitScript(() => {
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockWebSocket.OPEN;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor() {
        queueMicrotask(() => {
          this.onopen?.(new Event('open'));
          const payload = JSON.stringify({
            type: 'wallet',
            id: 'mock-wallet',
            name: 'Mock Wallet',
            balance: 42000
          });
          this.onmessage?.({ data: payload } as MessageEvent);
        });
      }

      send() {
        // no-op
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      }
    }

    window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  await page.route('**/api/bolt12/offers', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ offer: 'lno1mockofferxyz', offerId: 'offer123', label: 'mock-label' })
    });
  });

  await page.route('**/api/bolt12/invoices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ invoice: 'lni1mockinvoiceabc' })
    });
  });
});

test('offers view creates offer and invoice', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Offers/i }).click();
  await expect(page.getByText('BOLT12 Offers')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Description').fill('Quarterly update');
  await page.getByRole('button', { name: 'CREATE_OFFER' }).click();

  const offerWidget = page.locator('.offer-widget__title', { hasText: 'Offer' });
  await expect(offerWidget).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.offer-widget__value').first()).toContainText('lno1mock');

  await page.getByRole('button', { name: 'REQUEST_INVOICE' }).click();
  const invoiceWidget = page.locator('.offer-widget__title', { hasText: 'Invoice' });
  await expect(invoiceWidget).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.offer-widget__value').nth(1)).toContainText('lni1mock');
});

test('offer creation failure clears loading state and shows error', async ({ page }) => {
  await page.route('**/api/bolt12/offers', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'bolt12_description_too_long',
        message: 'Description must be 140 characters or fewer.'
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Offers/i }).click();
  await expect(page.getByText('BOLT12 Offers')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Description').fill('x'.repeat(200));
  const createButton = page.getByRole('button', { name: 'Create new BOLT12 offer' });
  await createButton.click();

  await expect(createButton).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('.offer-error')).toHaveText(
    'Description must be 140 characters or fewer.'
  );
});
