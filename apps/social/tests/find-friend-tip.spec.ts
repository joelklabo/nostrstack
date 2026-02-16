import { expect, type Page, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { loginWithNsec } from './helpers';
import { mockLnurlPay } from './helpers/lnurl-mocks';

const secretKey = generateSecretKey();
const friendPubkey = getPublicKey(secretKey);
const friendNpub = nip19.npubEncode(friendPubkey);
const now = Math.floor(Date.now() / 1000);

const profileEvent = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [],
    content: JSON.stringify({
      name: 'Lightning Friend',
      lud16: 'sats@example.com',
      about: 'Test profile with lightning address'
    })
  },
  secretKey
);

const postEvents = [
  finalizeEvent(
    {
      kind: 1,
      created_at: now - 10,
      tags: [],
      content: 'First zapgable post'
    },
    secretKey
  ),
  finalizeEvent(
    {
      kind: 1,
      created_at: now - 5,
      tags: [],
      content: 'Second zapgable post'
    },
    secretKey
  )
];

async function installMockRelay(page: Page) {
  const events = [profileEvent, ...postEvents];

  await page.addInitScript(
    ({ events }) => {
      type MockEvent = { data?: string; type?: string };
      type ListenerType = 'open' | 'message' | 'error' | 'close';
      type HandlerKey = `on${ListenerType}`;

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
        private listeners: Record<ListenerType, Set<(ev: MockEvent) => void>> = {
          open: new Set(),
          message: new Set(),
          error: new Set(),
          close: new Set()
        };

        constructor(url: string) {
          this.url = url;
          queueMicrotask(() => {
            this.readyState = MockWebSocket.OPEN;
            this.dispatch('open', { type: 'open' });
          });
        }

        private dispatch(type: ListenerType, event: MockEvent) {
          const handlerKey = `on${type}` as HandlerKey;
          const handler = this[handlerKey];
          if (typeof handler === 'function') handler(event);
          for (const listener of this.listeners[type] ?? []) {
            listener(event);
          }
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
                  this.dispatch('message', { data: JSON.stringify(['EVENT', subId, event]) });
                }
              }
              this.dispatch('message', { data: JSON.stringify(['EOSE', subId]) });
            }
          } catch {
            // ignore invalid payloads
          }
        }

        close() {
          this.readyState = MockWebSocket.CLOSED;
          this.dispatch('close', { type: 'close' });
        }

        addEventListener(type: string, handler: (ev: MockEvent) => void) {
          this.listeners[type]?.add(handler);
        }

        removeEventListener(type: string, handler: (ev: MockEvent) => void) {
          this.listeners[type]?.delete(handler);
        }
      }

      window.WebSocket = MockWebSocket as typeof WebSocket;
      globalThis.WebSocket = MockWebSocket as typeof WebSocket;
      window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
    },
    { events }
  );
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

test('find friend and tip flow', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await installMockRelay(page);
  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright friend tip'
  });
  await loginWithNsec(page);
  await dismissTourIfOpen(page);

  await page.click('text=Find friend');
  await page.screenshot({ path: 'test-results/debug-search-nav.png' });
  await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible({ timeout: 10000 });

  await page.getByLabel('Search query').fill(friendNpub);
  await page.getByRole('button', { name: 'Search' }).click();
  const openProfile = page.getByRole('button', { name: 'Open profile' });
  await expect(openProfile).toBeVisible({ timeout: 10000 });
  await openProfile.click();

  await expect(page.getByText('Lightning Friend').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Tip 500 sats/i)).toBeVisible();

  const zapButtons = page.locator('.zap-btn');
  const zapCount = await zapButtons.count();
  expect(
    zapCount,
    'Expected at least 2 zap buttons for friend-tip coverage'
  ).toBeGreaterThanOrEqual(2);

  for (const index of [0, 1]) {
    await zapButtons.nth(index).scrollIntoViewIfNeeded();
    await zapButtons.nth(index).click({ force: true });
    const modal = page.locator('.payment-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
    await modal.locator('button.payment-close').click({ force: true });
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  const sendButton = page.getByRole('button', { name: /SEND 500/i });
  await sendButton.waitFor({ state: 'visible', timeout: 15000 });
  await sendButton.scrollIntoViewIfNeeded();
  await sendButton.click({ force: true });
  const sendModal = page.locator('.payment-modal');
  await expect(sendModal).toBeVisible({ timeout: 10000 });
  await expect(sendModal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
  await sendModal.locator('button.payment-close').click({ force: true });
  await expect(sendModal).toBeHidden({ timeout: 10000 });

  expect(consoleErrors).toEqual([]);
});
