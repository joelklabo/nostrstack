import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import client from 'prom-client';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-embed-config.db';
process.env.PUBLIC_ORIGIN = 'https://demo.nostrstack.lol';
process.env.NOSTR_RELAYS = 'wss://relay.one,wss://relay.two';
process.env.NOSTR_EMBED_CDN = 'https://cdn.example.com/embed.js';
process.env.NOSTR_THEME_ACCENT = '#ff00ff';

type Server = Awaited<ReturnType<typeof import('../server.js')['buildServer']>>;
let server: Server;

describe('/embed-config', () => {
  beforeAll(async () => {
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    const { buildServer } = await import('../server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('requires tenant param', async () => {
    const res = await server.inject({ url: '/embed-config' });
    expect(res.statusCode).toBe(400);
  });

  it('returns tenant config', async () => {
    const res = await server.inject({
      url: '/embed-config?tenant=alice',
      headers: { host: 'blog.test' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lnAddress).toBe('alice@blog.test');
    expect(body.relays).toEqual(['wss://relay.one', 'wss://relay.two']);
    expect(body.embedScript).toBe('https://cdn.example.com/embed.js');
    expect(body.apiBase).toBe('https://demo.nostrstack.lol');
    expect(body.theme.accent).toBe('#ff00ff');
    expect(body.mock).toBe(false);
  });

  it('honors mock flag', async () => {
    process.env.DEV_MOCKS = 'true';
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const mockServer = await buildServer();
    const res = await mockServer.inject({ url: '/embed-config?tenant=bob' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.relays).toEqual(['mock']);
    expect(body.apiBase).toBe('mock');
    expect(body.mock).toBe(true);
    await mockServer.close();
  });
});
