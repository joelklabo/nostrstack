import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, nip19 } from 'nostr-tools';

test('profile lightning card renders with QR', async ({ page }) => {
  const secretKey = generateSecretKey();
  const nsec = nip19.nsecEncode(secretKey);
  const event = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: 'Lightning Tester',
        lud16: 'sats@example.com',
        about: 'Test profile'
      })
    },
    secretKey
  );

  await page.addInitScript(
    ({ event }) => {
      type MockEvent = { data?: string; type?: string };
      type MockListener = (ev: MockEvent) => void;

      class MockWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        url: string;
        readyState = MockWebSocket.CONNECTING;
        onopen: MockListener | null = null;
        onmessage: MockListener | null = null;
        onerror: MockListener | null = null;
        onclose: MockListener | null = null;
        constructor(url: string) {
          this.url = url;
          queueMicrotask(() => {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.({ type: 'open' });
          });
        }
        send(data: string) {
          try {
            const parsed = JSON.parse(data) as unknown[];
            if (parsed[0] === 'REQ') {
              const subId = parsed[1] as string;
              const filters = parsed.slice(2) as Array<{ kinds?: number[]; authors?: string[] }>;
              const matches = filters.some((filter) => {
                const kindOk = !filter.kinds || filter.kinds.includes(event.kind);
                const authorOk = !filter.authors || filter.authors.includes(event.pubkey);
                return kindOk && authorOk;
              });
              if (matches) {
                this.onmessage?.({ data: JSON.stringify(['EVENT', subId, event]) });
              }
              this.onmessage?.({ data: JSON.stringify(['EOSE', subId]) });
            }
          } catch {
            // ignore invalid payloads
          }
        }
        close() {
          this.readyState = MockWebSocket.CLOSED;
          this.onclose?.({ type: 'close' });
        }
        addEventListener(type: string, handler: MockListener) {
          if (type === 'open') this.onopen = handler;
          if (type === 'message') this.onmessage = handler;
          if (type === 'error') this.onerror = handler;
          if (type === 'close') this.onclose = handler;
        }
        removeEventListener(type: string) {
          if (type === 'open') this.onopen = null;
          if (type === 'message') this.onmessage = null;
          if (type === 'error') this.onerror = null;
          if (type === 'close') this.onclose = null;
        }
      }

      window.WebSocket = MockWebSocket as typeof WebSocket;
    },
    { event }
  );

  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(nsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Live Feed/ })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.lightning-card')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.lightning-card-qr img')).toBeVisible();
  await expect(page.locator('.lightning-card-value')).toContainText('sats@example.com');
});
