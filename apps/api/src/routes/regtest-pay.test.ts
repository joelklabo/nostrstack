import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import client from 'prom-client';
import { describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-regtest-pay.db';
process.env.LIGHTNING_PROVIDER = 'mock';
process.env.OP_NODE_WEBHOOK_SECRET = '';

const schema = resolve(process.cwd(), 'prisma/schema.prisma');
execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  }
);

describe('regtest pay route', () => {
  const TEST_TIMEOUT = 15000;

  it('returns 404 when regtest pay is disabled', async () => {
    process.env.ENABLE_REGTEST_PAY = 'false';
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const server = await buildServer();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/regtest/pay',
        payload: { invoice: 'lnbc1invalidinvoice' }
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ ok: false, error: 'regtest_pay_disabled' });
    } finally {
      await server.close();
    }
  }, TEST_TIMEOUT);

  it('returns 400 when payload is missing', async () => {
    process.env.ENABLE_REGTEST_PAY = 'true';
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const server = await buildServer();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/regtest/pay'
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  }, TEST_TIMEOUT);

  it('returns 400 for invalid invoices when enabled', async () => {
    process.env.ENABLE_REGTEST_PAY = 'true';
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const server = await buildServer();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/regtest/pay',
        payload: { invoice: 'bad' }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ ok: false, error: 'invalid_invoice' });
    } finally {
      await server.close();
    }
  }, TEST_TIMEOUT);

  it('falls back to LNbits when docker exec fails', async () => {
    process.env.ENABLE_REGTEST_PAY = 'true';
    process.env.REGTEST_PAY_STRATEGY = 'lnbits';
    process.env.LN_BITS_URL = 'http://lnbits.local';
    process.env.LN_BITS_API_KEY = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        payment_hash: 'hash',
        preimage: 'preimage',
        fee: 1,
        status: 'success'
      })
    } as Response);
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const server = await buildServer();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/regtest/pay',
        payload: { invoice: 'lnbcrt1mockinvoice' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        ok: true,
        payment_hash: 'hash',
        payment_preimage: 'preimage',
        fees_sat: 1
      });
    } finally {
      fetchSpy.mockRestore();
      await server.close();
    }
  }, TEST_TIMEOUT);
});
