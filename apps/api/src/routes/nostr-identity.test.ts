import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';
import { clearNip05Cache } from '../services/nip05-cache.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-nip05.db';
process.env.NIP05_PROXY_CACHE_TTL_SECONDS = '60';
process.env.NIP05_PROXY_NEGATIVE_TTL_SECONDS = '60';
process.env.NIP05_PROXY_TIMEOUT_MS = '250';
process.env.NIP05_PROXY_MAX_RESPONSE_BYTES = '65536';

const schema = resolve(process.cwd(), 'prisma/schema.prisma');
execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
});

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('/api/nostr/identity', () => {
  beforeAll(async () => {
    const { buildServer } = await import('../server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    clearNip05Cache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 400 when query is missing', async () => {
    const res = await server.inject({ url: '/api/nostr/identity' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid_nip05' });
  });

  it('returns 200 for valid nip05 responses', async () => {
    const pubkey = 'a'.repeat(64);
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        names: { alice: pubkey },
        relays: { [pubkey]: ['wss://relay.example'] }
      }),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      pubkey,
      nip05: 'alice@example.com',
      name: 'alice',
      domain: 'example.com',
      relays: ['wss://relay.example']
    });
    expect(body.fetchedAt).toEqual(expect.any(Number));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/.well-known/nostr.json?name=alice',
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('returns cached responses on repeat lookups', async () => {
    const pubkey = 'b'.repeat(64);
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        names: { alice: pubkey }
      }),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const first = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(first.statusCode).toBe(200);

    const second = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(second.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns cached 404 responses for negative lookups', async () => {
    const pubkey = 'c'.repeat(64);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ names: { alice: pubkey } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const first = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(first.statusCode).toBe(404);

    const second = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(second.statusCode).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 502 for upstream errors', async () => {
    const fetchMock = vi.fn(async () => new Response('oops', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'nip05_upstream_error', status: 500 });
  });

  it('returns 502 for invalid responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'nip05_invalid_response' });
  });

  it('returns 504 for timeout errors', async () => {
    const abortError = Object.assign(new Error('timeout'), { name: 'AbortError' });
    const fetchMock = vi.fn(async () => { throw abortError; });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(504);
    expect(res.json()).toMatchObject({ error: 'nip05_timeout' });
  });
});
