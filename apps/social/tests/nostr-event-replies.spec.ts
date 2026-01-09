import fs from 'node:fs';
import path from 'node:path';

import type { Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { type Event } from 'nostr-tools';
import { finalizeEvent } from 'nostr-tools/pure';

import { buildNostrEventResponse, resolveDocScreenshotPath } from './helpers';

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function makeReply(eventId: string, id: string, createdAt: number, content: string): Event {
  return {
    id,
    pubkey: 'f'.repeat(64),
    created_at: createdAt,
    kind: 1,
    tags: [['e', eventId]],
    content,
    sig: 'd'.repeat(128)
  };
}

const TEST_SECRET_KEY = new Uint8Array(32).fill(1);

function makeSignedEvent(
  createdAt: number,
  content: string,
  options: { kind?: number; tags?: string[][] } = {}
): Event {
  return finalizeEvent(
    {
      kind: options.kind ?? 1,
      tags: options.tags ?? [],
      content,
      created_at: createdAt
    },
    TEST_SECRET_KEY
  );
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(payload)
  });
}

test.describe('/nostr/:id replies', () => {
  test('renders replies and pagination', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const eventId = 'a'.repeat(64);
    const baseResponse = buildNostrEventResponse({ id: eventId, content: 'Main post' });

    const replyOne = makeReply(eventId, 'b'.repeat(64), 1710000100, 'Oldest reply');
    const replyTwo = makeReply(eventId, 'c'.repeat(64), 1710000200, 'Older reply');
    const replyThree = makeReply(eventId, 'd'.repeat(64), 1710000300, 'Newer reply');
    const replyFour = makeReply(eventId, 'e'.repeat(64), 1710000400, 'Newest reply');

    const firstPage = {
      ...baseResponse,
      replies: [replyThree, replyFour],
      replyPage: { hasMore: true, nextCursor: 'cursor-1' }
    };
    const secondPage = {
      ...baseResponse,
      replies: [replyOne, replyTwo],
      replyPage: { hasMore: false, nextCursor: null }
    };

    await page.route('**/api/nostr/event/*', async (route) => {
      const url = new URL(route.request().url());
      const id = url.pathname.split('/').pop() ?? '';
      if (id === eventId) {
        expect(url.searchParams.get('replyLimit')).toBe('50');
      }
      const cursor = url.searchParams.get('replyCursor');
      await fulfillJson(route, cursor === 'cursor-1' ? secondPage : firstPage);
    });

    await page.goto(`/nostr/${eventId}`);

    await expect(page.locator('.nostr-event-replies .nostr-event-section-title')).toHaveText(
      'Replies'
    );
    await expect(page.locator('.nostr-event-replies-list .post-card')).toHaveCount(2);

    const loadMore = page.getByRole('button', { name: /Load more replies/i });
    await expect(loadMore).toBeVisible();
    await loadMore.focus();
    await expect(loadMore).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.nostr-event-replies-list .post-card')).toHaveCount(4);

    const contents = await page
      .locator('.nostr-event-replies-list .post-content')
      .allTextContents();
    expect(contents[0]).toContain('Oldest reply');
    expect(contents[1]).toContain('Older reply');
    expect(contents[2]).toContain('Newer reply');
    expect(contents[3]).toContain('Newest reply');

    const screenshotPath = resolveDocScreenshotPath('nostr-event-replies/nostr-event-replies.png');
    ensureDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('shows empty replies state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const eventId = 'f'.repeat(64);
    const emptyResponse = {
      ...buildNostrEventResponse({ id: eventId, content: 'No replies yet' }),
      replies: [],
      replyPage: { hasMore: false, nextCursor: null }
    };

    await page.route('**/api/nostr/event/*', async (route) => {
      const url = new URL(route.request().url());
      const id = url.pathname.split('/').pop() ?? '';
      if (id === eventId) {
        expect(url.searchParams.get('replyLimit')).toBe('50');
      }
      await fulfillJson(route, emptyResponse);
    });

    await page.goto(`/nostr/${eventId}`);
    await expect(page.getByText('No replies yet.')).toBeVisible();

    const screenshotPath = resolveDocScreenshotPath('nostr-event-replies/nostr-event-empty.png');
    ensureDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('falls back to relays when API fails', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const event = makeSignedEvent(1710000000, 'Main post via relay');
    const eventId = event.id;
    const replyOne = makeSignedEvent(1710000100, 'Oldest reply', {
      tags: [['e', eventId]]
    });
    const replyTwo = makeSignedEvent(1710000200, 'Newest reply', {
      tags: [['e', eventId]]
    });
    const profile = makeSignedEvent(1710000001, JSON.stringify({ name: 'Relay Alice' }), {
      kind: 0
    });

    await page.addInitScript(
      (events) => {
        (window as unknown as { __NOSTRSTACK_MOCK_EVENTS__: unknown }).__NOSTRSTACK_MOCK_EVENTS__ =
          events;
      },
      [event, replyOne, replyTwo, profile]
    );

    await page.route('**/api/nostr/event/*', async (route) => {
      await route.fulfill({
        status: 500,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*'
        },
        body: JSON.stringify({ error: 'internal_error', message: 'Failed to resolve nostr event.' })
      });
    });

    await page.goto(`/nostr/${eventId}`);

    const fallbackAlert = page.locator('.nostr-event-replies-fallback');
    await expect(fallbackAlert).toBeVisible();
    await expect(fallbackAlert).toContainText('API unavailable');

    await expect(page.locator('.nostr-event-replies-list .post-card')).toHaveCount(2);
    const contents = await page
      .locator('.nostr-event-replies-list .post-content')
      .allTextContents();
    expect(contents[0]).toContain('Oldest reply');
    expect(contents[1]).toContain('Newest reply');

    const screenshotPath = resolveDocScreenshotPath(
      'nostr-event-replies/nostr-event-replies-fallback.png'
    );
    ensureDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('shows cursor error without losing replies', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const eventId = '6'.repeat(64);
    const baseResponse = buildNostrEventResponse({ id: eventId, content: 'Main post' });
    const replyOne = makeReply(eventId, '7'.repeat(64), 1710000100, 'Oldest reply');
    const replyTwo = makeReply(eventId, '8'.repeat(64), 1710000200, 'Newest reply');

    const firstPage = {
      ...baseResponse,
      replies: [replyOne, replyTwo],
      replyPage: { hasMore: true, nextCursor: 'cursor-bad' }
    };

    await page.route('**/api/nostr/event/*', async (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get('replyCursor');
      if (cursor) {
        await route.fulfill({
          status: 400,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*'
          },
          body: JSON.stringify({
            error: 'invalid_reply_cursor',
            message: 'replyCursor must be a non-empty string.'
          })
        });
        return;
      }
      await fulfillJson(route, firstPage);
    });

    await page.goto(`/nostr/${eventId}`);
    await expect(page.locator('.nostr-event-replies-list .post-card')).toHaveCount(2);

    const loadMore = page.getByRole('button', { name: /Load more replies/i });
    await loadMore.click();

    const warning = page.locator('.nostr-event-replies .ns-alert--warning');
    await expect(warning).toContainText('Some replies are unavailable');
    await expect(warning).toContainText('replyCursor must be a non-empty string.');

    await expect(page.locator('.nostr-event-replies-list .post-card')).toHaveCount(2);
    const contents = await page
      .locator('.nostr-event-replies-list .post-content')
      .allTextContents();
    expect(contents[0]).toContain('Oldest reply');
    expect(contents[1]).toContain('Newest reply');

    const screenshotPath = resolveDocScreenshotPath(
      'nostr-event-replies/nostr-event-replies-cursor-error.png'
    );
    ensureDir(screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
