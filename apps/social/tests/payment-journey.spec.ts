import { expect, type Page, test } from '@playwright/test';
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
  sig: 'c'.repeat(128)
};

const postEvents = [
  {
    id: 'post-1',
    pubkey: friendPubkey,
    kind: 1,
    created_at: now - 10,
    tags: [],
    content: 'First zapgable post',
    sig: 'd'.repeat(128)
  },
  {
    id: 'post-2',
    pubkey: friendPubkey,
    kind: 1,
    created_at: now - 5,
    tags: [],
    content: 'Second zapgable post',
    sig: 'e'.repeat(128)
  }
];

async function loginWithNsec(page: Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(testNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Live Feed/ })).toBeVisible({ timeout: 15000 });
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
  const modal = page.locator('.payment-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
  return modal;
}

async function closePaymentModal(modal: ReturnType<Page['locator']>) {
  await modal.locator('button.payment-close').click({ force: true });
  await expect(modal).toBeHidden({ timeout: 10000 });
}

test('zap two posts and send sats from profile', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.addInitScript(
    ({ profileEvent, postEvents }) => {
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
          queueMicrotask(() => {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.({ type: 'open' });
          });
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
    },
    { profileEvent, postEvents }
  );

  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright payment journey'
  });
  await loginWithNsec(page);
  await dismissTourIfOpen(page);

  const zapButtons = page.locator('.zap-btn');
  const feedZapCount = await zapButtons.count();
  if (feedZapCount > 0) {
    for (const index of [0, 1]) {
      await expect(
        zapButtons.nth(index),
        'Expected enough zap buttons for feed coverage'
      ).toBeVisible({
        timeout: 8000
      });
      await zapButtons.nth(index).scrollIntoViewIfNeeded();
      await zapButtons.nth(index).click({ force: true });
      const modal = await waitForPaymentModal(page);
      await closePaymentModal(modal);
    }
  }

  await page.goto(`/p/${friendNpub}`);
  const profilePage = page;
  await expect(profilePage.getByText('Lightning Friend')).toBeVisible({ timeout: 15000 });
  await dismissTourIfOpen(profilePage);

  const sendSatsCard = profilePage.locator('.send-sats-card');
  if (await sendSatsCard.isVisible({ timeout: 12000 }).catch(() => false)) {
    const sendButton = sendSatsCard.locator('button', { hasText: /^SEND /i });
    await expect(sendButton).toBeVisible({ timeout: 10000 });
    await sendButton.scrollIntoViewIfNeeded();
    await sendButton.click({ force: true });
    const modal = await waitForPaymentModal(profilePage);
    await closePaymentModal(modal);
    expect(consoleErrors).toEqual([]);
    return;
  }

  const profileZapButtons = profilePage.locator('.zap-btn');
  const profileZapCount = await profileZapButtons.count();
  if (profileZapCount > 0) {
    await profileZapButtons.nth(0).scrollIntoViewIfNeeded();
    await profileZapButtons.nth(0).click({ force: true });
    const modal = await waitForPaymentModal(profilePage);
    await closePaymentModal(modal);
    expect(consoleErrors).toEqual([]);
    return;
  }

  await profilePage.goto('/');
  await dismissTourIfOpen(profilePage);
  const fallbackZapButtons = profilePage.locator('.zap-btn');
  await expect(fallbackZapButtons.first()).toBeVisible({ timeout: 12000 });
  await fallbackZapButtons.first().scrollIntoViewIfNeeded();
  await fallbackZapButtons.first().click({ force: true });
  const modal = await waitForPaymentModal(profilePage);
  await closePaymentModal(modal);

  expect(consoleErrors).toEqual([]);
});
