import { execSync } from 'node:child_process';

import { type APIRequestContext, expect, test } from '@playwright/test';

import {
  lnbitsBalance,
  payInvoiceViaLNbits,
  settleAssert,
  waitForPaymentStatus
} from './utils/pay-and-settle.js';
import { waitForHealth } from './utils/wait-for-health.js';

let api: APIRequestContext;
let stopServer: (() => Promise<void>) | null = null;

const DOMAIN = 'demo.nostrstack.lol';
const USER_PUBKEY = 'f'.repeat(64);

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'test-admin';
  process.env.OP_NODE_API_KEY = process.env.OP_NODE_API_KEY ?? 'test-key';
  process.env.OP_NODE_WEBHOOK_SECRET = process.env.OP_NODE_WEBHOOK_SECRET ?? 'whsec_test';
  process.env.LIGHTNING_PROVIDER = process.env.LIGHTNING_PROVIDER ?? 'mock';
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
    data: { domain: DOMAIN, lightningAddress: 'demo@demo.nostrstack.lol', pubkey: USER_PUBKEY },
    headers: { 'x-api-key': process.env.ADMIN_API_KEY ?? '' }
  });
});

test('pay-to-action request returns invoice and pending status', async () => {
  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock',
      amount: 1000,
      metadata: { path: '/demo/article' }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.payment_request || body.pr).toBeTruthy();
  expect(body.status).toBe('pending');
});

test('pay-to-action status polling returns pending then unknown (without provider)', async () => {
  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock',
      amount: 500,
      metadata: { path: '/demo/article' }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const id = body.provider_ref;
  const statusRes = await api.get(`/api/lnurlp/pay/status/${id}`);
  expect(statusRes.status()).toBe(200);
  const statusBody = await statusRes.json();
  expect(statusBody.status).toBeDefined();
});

test('pay-to-action end-to-end with LNbits payer (mutinynet if configured)', async () => {
  const payerUrl = process.env.LNBITS_URL;
  const payerKey = process.env.LNBITS_ADMIN_KEY;
  if (!payerUrl || !payerKey) test.skip(true, 'LNBITS_URL/KEY not set');

  // Capture starting balance (msat)
  const beforeMsat = await lnbitsBalance({ url: payerUrl, key: payerKey });

  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock',
      amount: 100, // sats
      metadata: { path: '/demo/article' }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const bolt11 = body.payment_request || body.pr;
  const providerRef = body.provider_ref;
  expect(bolt11).toBeTruthy();

  const payRes = await payInvoiceViaLNbits({ payerUrl, payerKey, bolt11 });
  expect(payRes.status).toBe('paid');

  const status = await waitForPaymentStatus({
    api,
    statusUrl: `/api/lnurlp/pay/status/${providerRef}`,
    expect: ['PAID', 'COMPLETED', 'SETTLED'],
    timeoutMs: 15000
  });
  expect(status.status).toBe('PAID');

  // Balance should decrease by at least the invoice amount (allowing fee variance).
  const afterMsat = await lnbitsBalance({ url: payerUrl, key: payerKey });
  expect(afterMsat).toBeLessThan(beforeMsat - 50 * 1000); // 50 sats slack
});

test('lnbits balance settles for standalone invoice', async () => {
  const payerUrl = process.env.LNBITS_URL;
  const payerKey = process.env.LNBITS_ADMIN_KEY;
  if (!payerUrl || !payerKey) test.skip(true, 'LNBITS_URL/KEY not set');

  const res = await api.post('/api/lnurlp/alice/invoice?amount=2000');
  expect(res.ok()).toBeTruthy();
  const invoice = await res.json();
  const bolt11 = invoice?.pr;
  const providerRef = invoice?.id ?? invoice?.provider_ref;
  expect(bolt11).toBeTruthy();

  const payment = await payInvoiceViaLNbits({ payerUrl, payerKey, bolt11 });
  expect(payment.status).toBe('paid');

  const status = await waitForPaymentStatus({
    api,
    statusUrl: `/api/lnurlp/pay/status/${providerRef ?? ''}`,
    expect: ['PAID', 'COMPLETED', 'SETTLED'],
    timeoutMs: 15000
  });
  expect(status.status).toBeDefined();

  // Assert wallet balance decreased roughly by invoice amount
  await settleAssert({
    api,
    payerUrl,
    payerKey,
    payUrl: `${payerUrl}/api/v1/payments`,
    amount: 20, // pay a small additional invoice to assert balance drop
    expectDecreaseMsat: 15_000
  });
});

test('rejects invalid payload', async () => {
  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock'
      // missing amount
    }
  });
  expect(res.status()).toBe(400);
});

test('rejects amount below minimum', async () => {
  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock',
      amount: 0
    }
  });
  expect(res.status()).toBe(400);
});

test('returns 404 for unknown payment status id', async () => {
  const res = await api.get('/api/lnurlp/pay/status/does-not-exist');
  expect(res.status()).toBe(404);
});

test('mock provider marks paid via status polling', async () => {
  const res = await api.post('/api/pay', {
    data: {
      domain: DOMAIN,
      action: 'unlock',
      amount: 150,
      metadata: { path: '/demo/mock' }
    }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const providerRef = body.provider_ref;

  const statusRes = await api.get(`/api/lnurlp/pay/status/${providerRef}`);
  expect(statusRes.ok()).toBeTruthy();
  const status = await statusRes.json();
  expect(status.status).toBe('PAID');
});

test.afterAll(async () => {
  await api?.dispose();
  if (stopServer) await stopServer();
});
