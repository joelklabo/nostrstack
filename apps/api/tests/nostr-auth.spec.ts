import { execSync } from 'node:child_process';

import { type APIRequestContext, expect, test } from '@playwright/test';

import { waitForHealth } from './utils/wait-for-health.js';

let api: APIRequestContext;
let stopServer: (() => Promise<void>) | null = null;

const DOMAIN = 'demo.nostrstack.lol';

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'test-admin';
  process.env.OP_NODE_API_KEY = process.env.OP_NODE_API_KEY ?? 'test-key';
  process.env.OP_NODE_WEBHOOK_SECRET = process.env.OP_NODE_WEBHOOK_SECRET ?? 'whsec_test';
  const dbPath =
    process.env.DATABASE_URL ?? 'postgresql://nostrstack:nostrstack@localhost:5432/nostrstack';
  process.env.DATABASE_URL = dbPath;
  const schema = dbPath.startsWith('postgres') ? 'prisma/pg/schema.prisma' : 'prisma/schema.prisma';
  execSync(`pnpm exec prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  });

  const { buildServer } = await import('../src/server.js');
  const server = await buildServer();
  await server.listen({ port: 0, host: '127.0.0.1' });
  const port = server.server.address()?.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  stopServer = async () => server.close();
  await waitForHealth(`${baseUrl}/health`, 30000, true);

  api = await playwright.request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { host: DOMAIN }
  });

  await api.post('/api/admin/tenants', {
    data: { domain: DOMAIN, displayName: 'Demo Tenant' },
    headers: { 'x-api-key': process.env.ADMIN_API_KEY ?? '' }
  });
  await api.post('/api/admin/users', {
    data: { domain: DOMAIN, lightningAddress: 'demo@demo.nostrstack.lol', pubkey: 'f'.repeat(64) },
    headers: { 'x-api-key': process.env.ADMIN_API_KEY ?? '' }
  });
});

test('NIP-05 well-known response', async () => {
  const res = await api.get('/.well-known/nostr.json?name=demo');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.names).toBeDefined();
});

test.afterAll(async () => {
  await api?.dispose();
  if (stopServer) await stopServer();
});
