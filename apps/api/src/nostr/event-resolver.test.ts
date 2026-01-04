import type { PrismaClient } from '@prisma/client';
import { type Event,nip19 } from 'nostr-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCachedEvent } from './event-cache.js';
import { resolveNostrEvent } from './event-resolver.js';
import { selectRelays } from './relay-utils.js';

const querySyncMock = vi.fn(async (): Promise<Event[]> => []);

vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual<typeof import('nostr-tools')>('nostr-tools');
  return {
    ...actual,
    validateEvent: () => true,
    verifyEvent: () => true,
    SimplePool: class {
      get = vi.fn(async () => null);
      querySync = querySyncMock;
      close = vi.fn();
    }
  };
});

vi.mock('./event-cache.js', () => {
  return {
    getCachedEvent: vi.fn(),
    storeCachedEvent: vi.fn()
  };
});

const getCachedEventMock = vi.mocked(getCachedEvent);

const now = new Date();

const baseEvent: Event = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1710000000,
  kind: 1,
  tags: [],
  content: 'hello',
  sig: 'c'.repeat(128)
};

describe('relay selection', () => {
  it('merges relays in priority order and respects limits', () => {
    const relays = selectRelays({
      overrideRelays: ['wss://override.example', 'ws://bad.example'],
      targetRelays: ['wss://target.example', 'wss://override.example'],
      defaultRelays: ['wss://default.example'],
      maxRelays: 2
    });

    expect(relays).toEqual(['wss://override.example', 'wss://target.example']);
  });
});

describe('resolveNostrEvent', () => {
  beforeEach(() => {
    getCachedEventMock.mockReset();
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValue([]);
  });

  it('extracts references from cached events and handles missing profiles', async () => {
    const rootId = '1'.repeat(64);
    const replyId = '2'.repeat(64);
    const mentionId = '3'.repeat(64);
    const quoteId = '4'.repeat(64);
    const profileId = '5'.repeat(64);
    const address = `30023:${'6'.repeat(64)}:slug`;
    const inlineNoteId = '7'.repeat(64);
    const inlineProfileId = '8'.repeat(64);

    const event: Event = {
      ...baseEvent,
      id: rootId,
      tags: [
        ['e', rootId, '', 'root'],
        ['e', replyId, '', 'reply'],
        ['e', mentionId],
        ['q', quoteId],
        ['a', address],
        ['p', profileId]
      ],
      content: `nostr:${nip19.noteEncode(inlineNoteId)} and nostr:${nip19.npubEncode(inlineProfileId)}`
    };

    getCachedEventMock
      .mockResolvedValueOnce({
        event,
        relays: ['wss://relay.cached'],
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 10_000),
        source: 'event'
      })
      .mockResolvedValueOnce(null);

    const resolved = await resolveNostrEvent(rootId, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient
    });

    expect(resolved.author.profile).toBeNull();
    expect(resolved.relays).toEqual(['wss://relay.cached']);
    expect(resolved.references.root).toContain(rootId);
    expect(resolved.references.reply).toContain(replyId);
    expect(resolved.references.mention).toContain(mentionId);
    expect(resolved.references.mention).toContain(inlineNoteId);
    expect(resolved.references.quote).toContain(quoteId);
    expect(resolved.references.address).toContain(address.toLowerCase());
    expect(resolved.references.profiles).toContain(profileId);
    expect(resolved.references.profiles).toContain(inlineProfileId);
  });

  it('rejects invalid reply cursors', async () => {
    getCachedEventMock
      .mockResolvedValueOnce({
        event: baseEvent,
        relays: ['wss://relay.cached'],
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 10_000),
        source: 'event'
      })
      .mockResolvedValueOnce(null);

    await expect(
      resolveNostrEvent(baseEvent.id, {
        defaultRelays: ['wss://relay.default'],
        prisma: {} as PrismaClient,
        replyLimit: 10,
        replyCursor: 'not-a-valid-cursor'
      })
    ).rejects.toThrow('invalid_reply_cursor');
  });

  it('filters self-referential replies', async () => {
    const loopReplyId = 'c'.repeat(64);
    const goodReplyId = 'd'.repeat(64);
    const loopReply: Event = {
      id: loopReplyId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000001,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', loopReplyId, '', 'reply']
      ],
      content: 'loop reply',
      sig: 'e'.repeat(128)
    };
    const goodReply: Event = {
      id: goodReplyId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000002,
      kind: 1,
      tags: [['e', baseEvent.id, '', 'root']],
      content: 'good reply',
      sig: 'f'.repeat(128)
    };

    getCachedEventMock
      .mockResolvedValueOnce({
        event: baseEvent,
        relays: ['wss://relay.cached'],
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 10_000),
        source: 'event'
      })
      .mockResolvedValueOnce(null);

    querySyncMock.mockResolvedValueOnce([loopReply, goodReply]);

    const resolved = await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10
    });

    expect(resolved.replies).toEqual([goodReply]);
  });

  it('rejects when no relays are configured', async () => {
    await expect(resolveNostrEvent(baseEvent.id, { defaultRelays: [] })).rejects.toThrow('no_relays');
  });
});
