import { expect, test } from '@playwright/test';
import { nip19 } from 'nostr-tools';

import { mockLnurlPay } from './helpers/lnurl-mocks';

const testNsec =
  process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

const friendPubkey = 'b'.repeat(64);
const friendNpub = nip19.npubEncode(friendPubkey);
const now = Math.floor(Date.now() / 1000);

const profileEvent = {
  id: 'profile-event-1',
  pubkey: friendPubkey,
  kind: 0,
  created_at: now,
  tags: [],
  content: JSON.stringify({
    name: 'Lightning Friend',
    lud16: 'sats@example.com',
    about: 'Test profile with lightning address'
  }),
  sig: 'c'.repeat(128),
};

const postEvents = [
  {
    id: 'post-1',
    pubkey: friendPubkey,
    kind: 1,
    created_at: now - 10,
    tags: [],
    content: 'First zapgable post',
    sig: 'd'.repeat(128),
  },
  {
    id: 'post-2',
    pubkey: friendPubkey,
    kind: 1,
    created_at: now - 5,
    tags: [],
    content: 'Second zapgable post',
    sig: 'e'.repeat(128),
  },
];

async function loginWithNsec(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(testNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
}

test('zap two posts and send sats from profile', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.addInitScript(({ profileEvent, postEvents }) => {
    type MockEvent = { data?: string; type?: string };

    const events = [profileEvent, ...postEvents];

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      url: string;
      readyState = MockWebSocket.CONNECTING;
      onopen: ((ev: MockEvent) => void) | null = null;
      onmessage: ((ev: MockEvent) => void) | null = null;
      onerror: ((ev: MockEvent) => void) | null = null;
      onclose: ((ev: MockEvent) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.({ type: 'open' });
        }, 0);
      }

      send(data: string) {
        try {
          const parsed = JSON.parse(data) as unknown[];
          if (parsed[0] !== 'REQ') return;
          const subId = parsed[1] as string;
          const filters = parsed.slice(2) as Array<{ kinds?: number[]; authors?: string[] }>;
          const sent = new Set<string>();
          for (const filter of filters) {
            for (const event of events) {
              const kindOk = !filter.kinds || filter.kinds.includes(event.kind);
              const authorOk = !filter.authors || filter.authors.includes(event.pubkey);
              if (kindOk && authorOk && !sent.has(event.id)) {
                sent.add(event.id);
                this.onmessage?.({ data: JSON.stringify(['EVENT', subId, event]) });
              }
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

      addEventListener(type: string, handler: (ev: MockEvent) => void) {
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
    window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
  }, { profileEvent, postEvents });

  await mockLnurlPay(page);
  await loginWithNsec(page);

  const zapButtons = page.locator('.zap-btn');
  const count = await zapButtons.count();
  if (count < 2) {
    test.skip(true, 'Not enough zap buttons available');
    return;
  }

  for (const index of [0, 1]) {
    await zapButtons.nth(index).click();
    const modal = page.locator('.zap-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: 'CLOSE' }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  await page.goto(`/p/${friendNpub}`);
  await expect(page.getByText('SEND_SATS')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /send 500/i }).click();
  await expect(page.locator('.zap-modal')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });

  expect(consoleErrors).toEqual([]);
});
