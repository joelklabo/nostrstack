import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { Event } from 'nostr-tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveNostrEvent } from '../nostr/event-resolver.js';
import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-nostr-event.db';
process.env.NOSTR_RELAYS = 'wss://relay.one,wss://relay.two';
process.env.NOSTR_EVENT_CACHE_TTL_SECONDS = '600';
process.env.NOSTR_EVENT_REPLY_LIMIT = '20';
process.env.NOSTR_EVENT_REPLY_MAX_LIMIT = '50';
process.env.NOSTR_EVENT_REPLY_TIMEOUT_MS = '6000';

vi.mock('../nostr/event-resolver.js', () => {
  return {
    resolveNostrEvent: vi.fn()
  };
});

type Server = Awaited<ReturnType<typeof buildServerFn>>;
let server: Server;

const resolveMock = vi.mocked(resolveNostrEvent);

const baseEventId = 'a'.repeat(64);
const basePubkey = 'b'.repeat(64);
const baseReplyId = 'd'.repeat(64);

const baseReferences = {
  root: [],
  reply: [],
  mention: [],
  quote: [],
  address: [],
  profiles: []
};

const baseReply: Event = {
  id: baseReplyId,
  pubkey: basePubkey,
  created_at: 1710000001,
  kind: 1,
  tags: [],
  content: 'first reply',
  sig: 'd'.repeat(128)
};

function buildResolvedEvent(
  id: string,
  relays: string[],
  options: {
    includeReplies?: boolean;
    replyThreadId?: string;
    replies?: Event[];
    replyPage?: { hasMore: boolean; nextCursor: string | null };
  } = {}
) {
  const event: Event = {
    id,
    pubkey: basePubkey,
    created_at: 1710000000,
    kind: 1,
    tags: [],
    content: 'hello from nostr',
    sig: 'c'.repeat(128)
  };

  return {
    target: { type: 'event' as const, id, relays: [] },
    event,
    author: {
      pubkey: basePubkey,
      profile: { name: 'Alice' },
      profileEvent: null
    },
    relays,
    references: baseReferences,
    ...(options.includeReplies
      ? {
          replyThreadId: options.replyThreadId ?? id,
          replies: options.replies ?? [baseReply],
          replyPage: options.replyPage ?? { hasMore: false, nextCursor: null }
        }
      : {})
  };
}

describe('/api/nostr/event', () => {
  beforeAll(async () => {
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    execSync(
      `./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      }
    );
    const { buildServer } = await import('../server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockImplementation(async (id) => {
      if (id === 'badprefix') throw new Error('unsupported_id');
      if (id === 'invalid-id') throw new Error('invalid_id');
      if (id === 'not-found') throw new Error('not_found');
      if (id === 'invalid-event') throw new Error('invalid_event');
      if (id === 'timeout') throw new Error('Request timed out');
      if (id === 'cache-hit') return buildResolvedEvent(id, ['wss://cache.hit']);
      if (id === 'cache-miss') return buildResolvedEvent(id, ['wss://relay.one']);
      return buildResolvedEvent(id, ['wss://relay.one']);
    });
  });

  it('returns 200 for valid event ids', async () => {
    const res = await server.inject({ url: `/api/nostr/event/${baseEventId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.target).toEqual({
      input: baseEventId,
      type: 'event',
      id: baseEventId,
      relays: ['wss://relay.one']
    });
    expect(body.event.id).toBe(baseEventId);
    expect(body.author.pubkey).toBe(basePubkey);
    expect(body.references).toEqual(baseReferences);
    expect(resolveMock).toHaveBeenCalled();
  });

  it('passes relay overrides to the resolver', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?relays=wss://relay.override`
    });
    expect(res.statusCode).toBe(200);
    const call = resolveMock.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ relays: ['wss://relay.override'] }));
    expect(call?.[1]?.cacheTtlSeconds).toBe(600);
    expect(call?.[1]?.replyLimit).toBe(20);
    expect(call?.[1]?.replyMaxLimit).toBe(50);
    expect(call?.[1]?.replyTimeoutMs).toBe(6000);
    expect(call?.[1]?.prisma).toBeTruthy();
  });

  it('passes reply options to the resolver', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyLimit=12&replyCursor=cursor&timeoutMs=5000&replyTimeoutMs=4000`
    });
    expect(res.statusCode).toBe(200);
    const call = resolveMock.mock.calls[0];
    expect(call?.[1]).toEqual(
      expect.objectContaining({
        timeoutMs: 5000,
        replyLimit: 12,
        replyMaxLimit: 50,
        replyCursor: 'cursor',
        replyTimeoutMs: 4000
      })
    );
  });

  it('clamps reply limit to the configured max', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyLimit=500`
    });
    expect(res.statusCode).toBe(200);
    const call = resolveMock.mock.calls[0];
    expect(call?.[1]?.replyLimit).toBe(50);
  });

  it('allows zero replyLimit to fetch metadata only', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyLimit=0`
    });
    expect(res.statusCode).toBe(200);
    const call = resolveMock.mock.calls[0];
    expect(call?.[1]?.replyLimit).toBe(0);
  });

  it('rejects invalid reply cursors', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyCursor=`
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_reply_cursor',
      message: 'replyCursor must be a non-empty string.',
      requestId: expect.any(String)
    });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('returns replies when resolver includes reply data', async () => {
    resolveMock.mockResolvedValueOnce(
      buildResolvedEvent(baseEventId, ['wss://relay.one'], { includeReplies: true })
    );
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyLimit=5`
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.replyThreadId).toBe(baseEventId);
    expect(body.replies).toEqual([baseReply]);
    expect(body.replyPage).toEqual({ hasMore: false, nextCursor: null });
  });

  it('returns cached responses (cache hit) and fetched responses (cache miss)', async () => {
    const hit = await server.inject({ url: '/api/nostr/event/cache-hit' });
    expect(hit.statusCode).toBe(200);
    expect(hit.json().target.relays).toEqual(['wss://cache.hit']);

    const miss = await server.inject({ url: '/api/nostr/event/cache-miss' });
    expect(miss.statusCode).toBe(200);
    expect(miss.json().target.relays).toEqual(['wss://relay.one']);
  });

  it('rejects invalid relay overrides', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?relays=ws://example.com`
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_relays',
      message: 'Relays must use wss:// (or ws://localhost for dev).',
      invalidRelays: ['ws://example.com'],
      requestId: expect.any(String)
    });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('returns 400 for unsupported ids', async () => {
    const res = await server.inject({ url: '/api/nostr/event/badprefix' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_id',
      message: 'Unsupported or invalid nostr identifier.',
      requestId: expect.any(String)
    });
  });

  it('returns 400 for invalid ids', async () => {
    const res = await server.inject({ url: '/api/nostr/event/invalid-id' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_id',
      message: 'Identifier is empty or exceeds the maximum length.',
      requestId: expect.any(String)
    });
  });

  it('returns 404 when events are not found', async () => {
    const res = await server.inject({ url: '/api/nostr/event/not-found' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: 'not_found',
      message: 'Event not found on available relays.',
      requestId: expect.any(String)
    });
  });

  it('returns 422 when events fail verification', async () => {
    const res = await server.inject({ url: '/api/nostr/event/invalid-event' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: 'invalid_event',
      message: 'Event failed signature verification.',
      requestId: expect.any(String)
    });
  });
});
