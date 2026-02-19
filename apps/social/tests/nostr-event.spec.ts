import { expect, test } from '@playwright/test';
import { nip19 } from 'nostr-tools';

import { buildNostrEventResponse, mockNostrEventApi } from './helpers';

test.describe('/nostr/:id landing', () => {
  test('renders core fields and reference previews', async ({ page }) => {
    const eventId = 'a'.repeat(64);
    const rootId = 'b'.repeat(64);
    const replyId = 'c'.repeat(64);
    const quoteId = 'd'.repeat(64);
    const mentionId = 'e'.repeat(64);
    const profileId = 'f'.repeat(64);
    const addressPubkey = '1'.repeat(64);
    const addressCoord = `30023:${addressPubkey}:post`;
    const addressNaddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: addressPubkey,
      identifier: 'post'
    });

    const mainResponse = buildNostrEventResponse({
      id: eventId,
      content: 'Hello from the API fixture',
      relays: ['mock'],
      tags: [
        ['e', rootId, '', 'root'],
        ['e', replyId, '', 'reply'],
        ['e', mentionId],
        ['q', quoteId],
        ['a', addressCoord],
        ['p', profileId]
      ],
      references: {
        root: [rootId],
        reply: [replyId],
        mention: [mentionId],
        quote: [quoteId],
        address: [addressCoord],
        profiles: [profileId]
      }
    });

    const fixtures = {
      [eventId]: mainResponse,
      [rootId]: buildNostrEventResponse({ id: rootId, content: 'Root preview', relays: ['mock'] }),
      [replyId]: buildNostrEventResponse({
        id: replyId,
        content: 'Reply preview',
        relays: ['mock']
      }),
      [quoteId]: buildNostrEventResponse({
        id: quoteId,
        content: 'Quote preview',
        relays: ['mock']
      }),
      [mentionId]: buildNostrEventResponse({
        id: mentionId,
        content: 'Mention preview',
        relays: ['mock']
      }),
      [addressNaddr]: buildNostrEventResponse({
        id: '2'.repeat(64),
        content: 'Addressable preview',
        relays: ['mock']
      })
    };

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('requestfailed', (req) => failedRequests.push(req.url()));

    await mockNostrEventApi(page, fixtures);

    await page.goto(`/nostr/${eventId}`);

    await expect(page.locator('.nostr-event-title')).toHaveText('Note');
    await expect(page.getByText('Target')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('READY')).toBeVisible({ timeout: 15000 });

    const previewCards = page.locator('.nostr-event-preview-card');
    await expect(previewCards.first()).toBeVisible({ timeout: 15000 });
    await expect(previewCards).toHaveCount(5);
    await expect(page.getByText('Mentioned profiles')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('ignores invalid markdown image sources in event content', async ({ page }) => {
    const eventId = '0'.repeat(64);
    const invalidImageSource = `${eventId}:0`;

    const response = buildNostrEventResponse({
      id: eventId,
      content: `![broken image](${invalidImageSource})\nThis is still readable.`
    });

    const failedRequests: string[] = [];
    const consoleErrors: string[] = [];
    page.on('requestfailed', (req) => failedRequests.push(req.url()));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await mockNostrEventApi(page, { [eventId]: response });

    await page.goto(`/nostr/${eventId}`);
    await expect(page.locator('.nostr-event-title')).toHaveText('Note');

    expect(failedRequests).toEqual([]);
    const relevantErrors = consoleErrors.filter(
      (e) => !e.includes('WebSocket') && !e.includes('ERR_NAME_NOT_RESOLVED')
    );
    expect(relevantErrors).toEqual([]);
  });

  test('shows error state when event is not found', async ({ page }) => {
    const eventId = 'z'.repeat(64);

    await page.addInitScript(() => {
      class MockWebSocket {
        constructor() {
          throw new Error('WebSocket disabled in test');
        }
      }
      window.WebSocket = MockWebSocket as unknown as typeof window.WebSocket;
    });

    await mockNostrEventApi(page, {}, 404);

    await page.goto(`/nostr/${eventId}`);
    await expect(page.getByText(/ERROR:/)).toBeVisible({ timeout: 15000 });
  });

  test('renders profile-only targets', async ({ page }) => {
    const pubkey = '9'.repeat(64);
    const npub = nip19.npubEncode(pubkey);
    const profileEventId = '8'.repeat(64);

    const profileResponse = buildNostrEventResponse({
      id: profileEventId,
      pubkey,
      kind: 0,
      content: JSON.stringify({ name: 'Satoshi', about: 'Profile content' }),
      targetType: 'profile',
      targetOverrides: { input: npub }
    });

    await mockNostrEventApi(page, { [npub]: profileResponse });

    await page.goto(`/nostr/${npub}`);
    await expect(page.locator('.nostr-event-title')).toHaveText('Profile');
    await expect(page.locator('.nostr-event-card').getByText('Satoshi')).toBeVisible();
  });
});
