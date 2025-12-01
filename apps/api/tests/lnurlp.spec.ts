import { execSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { waitForHealth } from './utils/wait-for-health.js';

const DEMO_ADDR = 'demo@demo.nostrstack.lol';

let api;
let stopServer: (() => Promise<void>) | null = null;

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'test-admin';
  process.env.OP_NODE_API_KEY = process.env.OP_NODE_API_KEY ?? 'test-key';
  process.env.OP_NODE_WEBHOOK_SECRET = process.env.OP_NODE_WEBHOOK_SECRET ?? 'whsec_test';
  const dbPath = process.env.DATABASE_URL ?? 'postgresql://nostrstack:nostrstack@localhost:5432/nostrstack';
  process.env.DATABASE_URL = dbPath;
  const schema = dbPath.startsWith('postgres') ? 'prisma/pg/schema.prisma' : 'prisma/schema.prisma';

  const pushCmd = `pnpm exec prisma db push --skip-generate --accept-data-loss --schema ${schema}`;
  execSync(pushCmd, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  });

  const { buildServer } = await import('../src/server.js');
  const server = await buildServer();
  await server.listen({ port: 0, host: '127.0.0.1' });
  const port = server.server.address()?.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  stopServer = async () => server.close();

  await waitForHealth(`${baseUrl}/health`);
  api = await playwright.request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { host: 'demo.nostrstack.lol' }
  });

  await api.post('/api/admin/tenants', {
    data: { domain: 'demo.nostrstack.lol', displayName: 'Demo Tenant' },
    headers: { 'x-api-key': process.env.ADMIN_API_KEY ?? '' }
  });
  await api.post('/api/admin/users', {
    data: { domain: 'demo.nostrstack.lol', lightningAddress: DEMO_ADDR, pubkey: 'f'.repeat(64) },
    headers: { 'x-api-key': process.env.ADMIN_API_KEY ?? '' }
  });
});

test('lnurlp metadata and invoice', async () => {
  const resMeta = await api.get('/.well-known/lnurlp/demo');
  expect(resMeta.ok()).toBeTruthy();
  const meta = await resMeta.json();
  expect(meta.callback).toContain('/api/lnurlp/demo/invoice');

  const callbackUrl = new URL(meta.callback);
  const resInv = await api.get(`${callbackUrl.pathname}?amount=2000`);
  expect(resInv.ok()).toBeTruthy();
  const inv = await resInv.json();
  expect(inv.pr).toBeTruthy();
});

test.afterAll(async () => {
  await api?.dispose();
  if (stopServer) await stopServer();
});
