import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
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

  it('filters short reply cycles', async () => {
    const replyAId = 'e'.repeat(64);
    const replyBId = 'f'.repeat(64);
    const replyCId = '1'.repeat(64);

    const replyA: Event = {
      id: replyAId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000001,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyBId, '', 'reply']
      ],
      content: 'reply A',
      sig: 'd'.repeat(128)
    };
    const replyB: Event = {
      id: replyBId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000002,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyAId, '', 'reply']
      ],
      content: 'reply B',
      sig: 'e'.repeat(128)
    };
    const replyC: Event = {
      id: replyCId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000003,
      kind: 1,
      tags: [['e', baseEvent.id, '', 'root']],
      content: 'reply C',
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

    querySyncMock.mockResolvedValueOnce([replyA, replyB, replyC]);

    const resolved = await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10
    });

    expect(resolved.replies).toEqual([replyC]);
  });

  it('filters multi-hop reply cycles', async () => {
    const replyAId = '2'.repeat(64);
    const replyBId = '3'.repeat(64);
    const replyCId = '4'.repeat(64);
    const replyDId = '5'.repeat(64);

    const replyA: Event = {
      id: replyAId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000011,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyBId, '', 'reply']
      ],
      content: 'reply A',
      sig: 'a'.repeat(128)
    };
    const replyB: Event = {
      id: replyBId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000012,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyCId, '', 'reply']
      ],
      content: 'reply B',
      sig: 'b'.repeat(128)
    };
    const replyC: Event = {
      id: replyCId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000013,
      kind: 1,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyAId, '', 'reply']
      ],
      content: 'reply C',
      sig: 'c'.repeat(128)
    };
    const replyD: Event = {
      id: replyDId,
      pubkey: baseEvent.pubkey,
      created_at: 1710000014,
      kind: 1,
      tags: [['e', baseEvent.id, '', 'root']],
      content: 'reply D',
      sig: 'd'.repeat(128)
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

    querySyncMock.mockResolvedValueOnce([replyB, replyD, replyC, replyA]);

    const resolved = await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10
    });

    expect(resolved.replies).toEqual([replyD]);
  });

  it('stops cycle detection after max-hop limit', async () => {
    const replyAId = '11'.repeat(32);
    const replyBId = '12'.repeat(32);
    const replyCId = '13'.repeat(32);

    const replyA: Event = {
      ...baseEvent,
      id: replyAId,
      created_at: 1710000001,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyBId, '', 'reply']
      ],
      content: 'reply A'
    };
    const replyB: Event = {
      ...baseEvent,
      id: replyBId,
      created_at: 1710000002,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyCId, '', 'reply']
      ],
      content: 'reply B'
    };
    const replyC: Event = {
      ...baseEvent,
      id: replyCId,
      created_at: 1710000003,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyAId, '', 'reply']
      ],
      content: 'reply C'
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

    querySyncMock.mockResolvedValueOnce([replyA, replyB, replyC]);

    // With limit 2, the 3-hop cycle A->B->C->A is not detected
    const resolved = await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10,
      replyMaxCycleHops: 2
    });

    // All events returned because cycle was not detected within 2 hops
    expect(resolved.replies).toHaveLength(3);
    expect(resolved.replies).toContainEqual(replyA);
    expect(resolved.replies).toContainEqual(replyB);
    expect(resolved.replies).toContainEqual(replyC);
  });

  it('handles 0 or negative hop limit safely', async () => {
    const replyAId = '21'.repeat(32);
    const replyBId = '22'.repeat(32);
    const replyA: Event = {
      ...baseEvent,
      id: replyAId,
      created_at: 1710000001,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyBId, '', 'reply']
      ],
      content: 'reply A'
    };
    const replyB: Event = {
      ...baseEvent,
      id: replyBId,
      created_at: 1710000002,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyAId, '', 'reply']
      ],
      content: 'reply B'
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

    querySyncMock.mockResolvedValueOnce([replyA, replyB]);

    const resolved = await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10,
      replyMaxCycleHops: 0
    });

    // With 0 hops, even 2-hop cycle is not detected
    expect(resolved.replies).toHaveLength(2);
    expect(resolved.replies).toContainEqual(replyA);
    expect(resolved.replies).toContainEqual(replyB);
  });

  it('logs when reply cycles are detected', async () => {
    const replyAId = '31'.repeat(32);
    const replyBId = '32'.repeat(32);

    const replyA: Event = {
      ...baseEvent,
      id: replyAId,
      created_at: 1710000001,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyBId, '', 'reply']
      ],
      content: 'reply A'
    };
    const replyB: Event = {
      ...baseEvent,
      id: replyBId,
      created_at: 1710000002,
      tags: [
        ['e', baseEvent.id, '', 'root'],
        ['e', replyAId, '', 'reply']
      ],
      content: 'reply B'
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

    querySyncMock.mockResolvedValueOnce([replyA, replyB]);

    const warnMock = vi.fn();
    const loggerMock = {
      warn: warnMock,
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      silent: vi.fn(),
      child: vi.fn(() => loggerMock),
      level: 'warn'
    } as unknown as FastifyBaseLogger;

    await resolveNostrEvent(baseEvent.id, {
      defaultRelays: ['wss://relay.default'],
      prisma: {} as PrismaClient,
      replyLimit: 10,
      logger: loggerMock
    });

    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleCount: 2,
        threadId: baseEvent.id
      }),
      'detected and dropped reply cycles'
    );
  });

  it('rejects when no relays are configured', async () => {
    await expect(resolveNostrEvent(baseEvent.id, { defaultRelays: [] })).rejects.toThrow('no_relays');
  });
});
