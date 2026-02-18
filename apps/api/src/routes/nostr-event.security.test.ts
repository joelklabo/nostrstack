import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { Event } from 'nostr-tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveNostrEvent } from '../nostr/event-resolver.js';
import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-nostr-event-security.db';
process.env.NOSTR_RELAYS = 'wss://relay.one,wss://relay.two';
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

const baseReferences = {
  root: [],
  reply: [],
  mention: [],
  quote: [],
  address: [],
  profiles: []
};

function buildResolvedEvent(id: string, relays: string[]) {
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
    references: baseReferences
  };
}

describe('/api/nostr/event security', () => {
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
    if (server) {
      await server.close();
    }
  });

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(buildResolvedEvent(baseEventId, ['wss://relay.one']));
  });

  it('rejects invalid timeoutMs values', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?timeoutMs=0`
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_timeout',
      message: 'timeoutMs must be a positive integer.',
      requestId: expect.any(String)
    });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects invalid replyTimeoutMs values', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyTimeoutMs=0`
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_reply_timeout',
      message: 'replyTimeoutMs must be a positive integer.',
      requestId: expect.any(String)
    });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects relay overrides with invalid entries', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?relays=wss://relay.one,ws://example.com`
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

  it('clamps oversized reply limits to the configured max', async () => {
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyLimit=500`
    });
    expect(res.statusCode).toBe(200);
    const call = resolveMock.mock.calls[0];
    expect(call?.[1]?.replyLimit).toBe(50);
  });

  it('returns 400 when resolver flags invalid reply cursors', async () => {
    resolveMock.mockRejectedValueOnce(new Error('invalid_reply_cursor'));
    const res = await server.inject({
      url: `/api/nostr/event/${baseEventId}?replyCursor=not-a-valid-cursor`
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'invalid_reply_cursor',
      message: 'replyCursor must be a non-empty string.',
      requestId: expect.any(String)
    });
  });
});
