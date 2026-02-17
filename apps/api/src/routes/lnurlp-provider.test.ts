import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.OP_NODE_WEBHOOK_SECRET = '';
process.env.DATABASE_URL = 'file:./tmp-lnurl-provider.db';
process.env.LIGHTNING_PROVIDER = 'mock';

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('lnurl invoice provider field', () => {
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
    await server.close();
  });

  it('stores payment.provider based on env.LIGHTNING_PROVIDER', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow();
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk' } },
      create: {
        tenantId: tenant.id,
        pubkey: 'pk',
        lightningAddress: 'alice@default'
      },
      update: {}
    });

    const inv = await server.inject({ url: '/api/lnurlp/alice/invoice?amount=1000' });
    expect(inv.statusCode).toBe(200);

    const payment = await server.prisma.payment.findFirstOrThrow();
    expect(payment.provider).toBe('mock');
  });

  it('returns successAction for valid payloads', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow();
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk-success' } },
      create: {
        tenantId: tenant.id,
        pubkey: 'pk-success',
        lightningAddress: 'success@default',
        lnurlSuccessAction: JSON.stringify({ tag: 'message', message: 'Thanks!' })
      },
      update: {
        lnurlSuccessAction: JSON.stringify({ tag: 'message', message: 'Thanks!' })
      }
    });

    const res = await server.inject({ url: '/.well-known/lnurlp/success' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { successAction?: { tag?: string; message?: string } };
    expect(body.successAction?.tag).toBe('message');
    expect(body.successAction?.message).toBe('Thanks!');
  });

  it('resolves .well-known lnurl metadata case-insensitively', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow();
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk-case-insensitive-meta' } },
      create: {
        tenantId: tenant.id,
        pubkey: 'pk-case-insensitive-meta',
        lightningAddress: 'case@default'
      },
      update: {}
    });

    const res = await server.inject({ url: '/.well-known/lnurlp/Case' });
    expect(res.statusCode).toBe(200);

    const domainScopedRes = await server.inject({ url: '/.well-known/lnurlp/Case@default' });
    expect(domainScopedRes.statusCode).toBe(200);
  });

  it('normalizes encoded domain-scoped identifiers in lnurl metadata', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow();
    await server.prisma.user.upsert({
      where: {
        tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk-encoded-meta' }
      },
      create: {
        tenantId: tenant.id,
        pubkey: 'pk-encoded-meta',
        lightningAddress: 'encoded@default'
      },
      update: {}
    });

    const domainEncodedRes = await server.inject({ url: '/.well-known/lnurlp/eNcOdEd%40default' });
    expect(domainEncodedRes.statusCode).toBe(200);
    const body = domainEncodedRes.json() as { metadata?: string; callback?: string };
    expect(body.metadata).toContain('"eNcOdEd@default"');
    expect(body.callback).toContain('/api/lnurlp/eNcOdEd/invoice');
    expect(body.callback).not.toContain('%40');
  });

  it('rejects invalid successAction payloads', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow();
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk-invalid' } },
      create: {
        tenantId: tenant.id,
        pubkey: 'pk-invalid',
        lightningAddress: 'invalid@default',
        lnurlSuccessAction: '{"tag":"url","url":"javascript:alert(1)"}'
      },
      update: {
        lnurlSuccessAction: '{"tag":"url","url":"javascript:alert(1)"}'
      }
    });

    const res = await server.inject({ url: '/.well-known/lnurlp/invalid' });
    expect(res.statusCode).toBe(400);
    expect(res.json().status).toBe('ERROR');
  });
});
