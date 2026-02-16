import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { mockLnurlPay } from './helpers/lnurl-mocks';

test.use({ video: 'on' });

const testNsec =
  process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

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

async function loginWithNsec(page: Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(testNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Live Feed/ })).toBeVisible({ timeout: 15000 });
}

async function installMockRelay(page: Page) {
  const events = [profileEvent, ...postEvents];

  await page.addInitScript(({ events }) => {
    type MockEvent = { data?: string; type?: string };

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
      private listeners: Record<string, Set<(ev: MockEvent) => void>> = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set()
      };

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.dispatch('open', { type: 'open' });
        }, 0);
      }

      private dispatch(type: string, event: MockEvent) {
        const handler = (this as Record<string, ((ev: MockEvent) => void) | null>)[`on${type}`];
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
  }, { events });
}

async function saveVideo(page: Page, testInfo: TestInfo) {
  const video = page.video();
  if (!video) return;
  await page.close().catch(() => {});
  const source = await video.path();
  for (let i = 0; i < 30; i += 1) {
    try {
      const stat = await fs.stat(source);
      if (stat.size > 0) break;
    } catch {
      // ignore missing file until it is written
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const outputDir = path.join(repoRoot, '.logs', 'video');
  await fs.mkdir(outputDir, { recursive: true });
  const safeTitle = testInfo.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const destination = path.join(outputDir, `${safeTitle}-${Date.now()}.webm`);
  await fs.copyFile(source, destination);
}

test.afterEach(async ({ page }, testInfo) => {
  await saveVideo(page, testInfo);
});

test('find friend tip flow video', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await installMockRelay(page);
  await mockLnurlPay(page);
  await loginWithNsec(page);

  await page.getByRole('navigation').getByRole('button', { name: 'Find friend' }).click();
  await expect(page.getByRole('heading', { name: 'Find friend' })).toBeVisible();

  await page.getByLabel('Friend identifier').fill(friendNpub);
  await page.getByRole('button', { name: 'Search' }).click();
  const openProfile = page.getByRole('button', { name: 'Open profile' });
  await expect(openProfile).toBeVisible({ timeout: 10000 });
  await openProfile.click();

  await expect(page.getByText('Lightning Friend')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Tip 500 sats/i)).toBeVisible();

  const zapButtons = page.locator('.zap-btn');
  await expect(zapButtons.first()).toBeVisible({ timeout: 10000 });
  const zapCount = await zapButtons.count();
  expect(zapCount).toBeGreaterThanOrEqual(2);

  for (const index of [0, 1]) {
    await zapButtons.nth(index).scrollIntoViewIfNeeded();
    await zapButtons.nth(index).click();
    const modal = page.locator('.payment-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
    await modal.locator('button.payment-action', { hasText: 'CLOSE' }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  const sendButton = page.getByRole('button', { name: /SEND 500/i });
  await sendButton.scrollIntoViewIfNeeded();
  await sendButton.click();
  const sendModal = page.locator('.payment-modal');
  await expect(sendModal).toBeVisible({ timeout: 10000 });
  await expect(sendModal.getByText(/Invoice ready/i)).toBeVisible({ timeout: 10000 });
  await sendModal.locator('button.payment-action', { hasText: 'CLOSE' }).click();
  await expect(sendModal).toBeHidden({ timeout: 10000 });

  expect(consoleErrors).toEqual([]);
});
