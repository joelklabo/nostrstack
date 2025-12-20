import { expect, test } from '@playwright/test';

test('withdraw modal shows QR and status', async ({ page }) => {
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
        setTimeout(() => {
          this.onopen?.(new Event('open'));
          const payload = JSON.stringify({
            type: 'wallet',
            id: 'mock-wallet',
            name: 'Mock Wallet',
            balance: 42000
          });
          this.onmessage?.({ data: payload } as MessageEvent);
        }, 0);
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

  const requestPayload = {
    k1: 'a'.repeat(64),
    lnurl: 'lnurl1test',
    requestUrl: `/api/lnurl-withdraw/${'a'.repeat(64)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };

  await page.route('**/api/lnurl-withdraw/request', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(requestPayload)
    });
  });

  await page.route('**/api/lnurl-withdraw/status/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'PENDING' })
    });
  });

  await page.goto('/');

  const withdrawBtn = page.getByRole('button', { name: /Withdraw via LNURL/i });
  await expect(withdrawBtn).toBeVisible({ timeout: 15000 });
  await withdrawBtn.click();

  await expect(page.getByText('Withdraw Funds')).toBeVisible();
  await expect(page.locator('.withdraw-status')).toHaveText(/Scan QR or open your wallet to claim\./);
  await expect(page.locator('.withdraw-qr img')).toBeVisible();
});
