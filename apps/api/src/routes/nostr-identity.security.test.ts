import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';
import { clearNip05Cache } from '../services/nip05-cache.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-nip05-security.db';
process.env.NIP05_PROXY_CACHE_TTL_SECONDS = '60';
process.env.NIP05_PROXY_NEGATIVE_TTL_SECONDS = '60';
process.env.NIP05_PROXY_TIMEOUT_MS = '250';
process.env.NIP05_PROXY_MAX_RESPONSE_BYTES = '200';
process.env.NIP05_PROXY_ALLOW_HTTP_LOCALHOST = 'true';

const schema = resolve(process.cwd(), 'prisma/schema.prisma');
execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
});

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('/api/nostr/identity security', () => {
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

  it('rejects non-HTTPS nip05 inputs', async () => {
    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@http://example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid_nip05' });
  });

  it('allows http for localhost when explicitly enabled', async () => {
    const pubkey = 'd'.repeat(64);
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ names: { alice: pubkey } }),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@localhost' });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/.well-known/nostr.json?name=alice',
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('rejects redirects from upstream', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('redirect not allowed');
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'nip05_proxy_failed' });
  });

  it('rejects oversized responses', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ names: { alice: 'e'.repeat(64) } }),
      {
        status: 200,
        headers: { 'content-length': '9999' }
      }
    ));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await server.inject({ url: '/api/nostr/identity?nip05=alice@example.com' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'nip05_response_too_large' });
  });
});
