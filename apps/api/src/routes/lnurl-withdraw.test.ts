import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { bech32 } from '@scure/base';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-lnurl-withdraw.db';
process.env.ENABLE_LNURL_WITHDRAW = 'true';
process.env.LIGHTNING_PROVIDER = 'lnbits';
process.env.LN_BITS_URL = 'http://localhost:3000';
process.env.LN_BITS_API_KEY = 'test-key';

const schema = resolve(process.cwd(), 'prisma/schema.prisma');
execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
});

let server: Awaited<ReturnType<typeof buildServerFn>>;

function buildInvoice(amount: string) {
  return bech32.encode(`lnbcrt${amount}`, [0, 1, 2], 2000);
}

describe('lnurl-withdraw routes', () => {
  beforeAll(async () => {
    const { buildServer } = await import('../server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates request + returns status', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/lnurl-withdraw/request',
      payload: { minWithdrawable: 1000, maxWithdrawable: 2000000 }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { k1: string; lnurl: string };
    expect(body.k1).toHaveLength(64);
    expect(body.lnurl).toBeTruthy();

    const requestRes = await server.inject({ url: `/api/lnurl-withdraw/${body.k1}` });
    expect(requestRes.statusCode).toBe(200);
    const requestBody = requestRes.json() as { tag: string; minWithdrawable: number; maxWithdrawable: number };
    expect(requestBody.tag).toBe('withdrawRequest');
    expect(requestBody.minWithdrawable).toBe(1000);
    expect(requestBody.maxWithdrawable).toBe(2000000);

    const statusRes = await server.inject({ url: `/api/lnurl-withdraw/status/${body.k1}` });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json()).toMatchObject({ status: 'PENDING' });
  });

  it('rejects invalid invoices', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/lnurl-withdraw/request',
      payload: { minWithdrawable: 1000, maxWithdrawable: 2000000 }
    });
    const body = res.json() as { k1: string };

    const callbackRes = await server.inject({
      url: `/api/lnurl-withdraw/callback?k1=${body.k1}&pr=bad`
    });
    expect(callbackRes.statusCode).toBe(400);
    expect(callbackRes.json()).toMatchObject({ status: 'ERROR', reason: 'invalid_invoice' });
  });

  it('treats duplicate callbacks as idempotent', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/lnurl-withdraw/request',
      payload: { minWithdrawable: 1000, maxWithdrawable: 2000000 }
    });
    const body = res.json() as { k1: string };

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ paid: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const invoice = buildInvoice('10u');
    const callbackUrl = `/api/lnurl-withdraw/callback?k1=${body.k1}&pr=${encodeURIComponent(invoice)}`;
    const first = await server.inject({ url: callbackUrl });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ status: 'OK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await server.inject({ url: callbackUrl });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ status: 'OK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
