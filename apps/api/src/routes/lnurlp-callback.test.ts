import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.OP_NODE_WEBHOOK_SECRET = '';
process.env.DATABASE_URL = 'file:./tmp-lnurl.db';

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('lnurl webhook', () => {
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

  it('returns 202 for unknown payment (replay-safe)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/lnurlp/alice/webhook',
      payload: { id: 'missing', status: 'paid' }
    });
    expect(res.statusCode).toBe(202);
  });

  it('polls status and marks paid', async () => {
    // create invoice via normal flow
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: (await server.prisma.tenant.findFirstOrThrow()).id, pubkey: 'pk' } },
      create: {
        tenantId: (await server.prisma.tenant.findFirstOrThrow()).id,
        pubkey: 'pk',
        lightningAddress: 'alice@default'
      },
      update: {}
    });

    const inv = await server.inject({ url: '/api/lnurlp/alice/invoice?amount=1000' });
    const body = inv.json();
    expect(inv.statusCode).toBe(200);
    expect(body.pr).toBeTruthy();

    const payment = await server.prisma.payment.findFirstOrThrow({ where: { invoice: body.pr } });
    expect(body.provider_ref).toBe(payment.providerRef);

    const statusRes = await server.inject({ url: `/api/lnurlp/alice/status/${payment.providerRef}` });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().status).toBe('PAID');
  });
});
