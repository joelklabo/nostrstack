import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.OP_NODE_WEBHOOK_SECRET = '';
process.env.NOSTR_SECRET_KEY = '1'.repeat(64);
process.env.DATABASE_URL = 'file:./tmp-nostr.db';

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('nostr', () => {
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

  beforeEach(async () => {
    await server.prisma.payment.deleteMany({});
    await server.prisma.user.deleteMany({});
  });

  afterAll(async () => {
    if (server) await server.close();
  });

  it('returns multi-name nostr.json', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow({ where: { domain: 'default' } });
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk1' } },
      create: { tenantId: tenant.id, pubkey: 'pk1', lightningAddress: 'alice@default' },
      update: {}
    });
    await server.prisma.user.upsert({
      where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'pk2' } },
      create: { tenantId: tenant.id, pubkey: 'pk2', lightningAddress: 'bob@default' },
      update: {}
    });

    const res = await server.inject({ url: '/.well-known/nostr.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.names.alice).toBe('pk1');
    expect(body.names.bob).toBe('pk2');
    expect(body.relays.alice).toEqual(server.nostrRelays ?? []);
  });

  it('publishes zap receipt on paid webhook', async () => {
    const tenant = await server.prisma.tenant.findFirstOrThrow({ where: { domain: 'default' } });
    const user = await server.prisma.user.create({
      data: { tenantId: tenant.id, pubkey: 'pkz', lightningAddress: 'zap@default' }
    });

    await server.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        provider: 'opennode',
        providerRef: 'pay123',
        invoice: 'lnbc1zapinvoice',
        amountSats: 21,
        status: 'PENDING'
      }
    });

    const publish = vi.fn().mockResolvedValue({ successes: 1, failures: 0 });
    // Override nostr client + relays to avoid network
    (server as unknown as { nostrClient: unknown }).nostrClient = { publish };
    server.nostrRelays = [];

    const res = await server.inject({
      method: 'POST',
      url: '/api/lnurlp/zap/webhook',
      payload: { id: 'pay123', status: 'paid' }
    });
    expect(res.statusCode).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    const args = publish.mock.calls[0][0];
    expect(args.template.kind).toBe(9735);
    expect(args.template.tags.find((t: string[]) => t[0] === 'bolt11')[1]).toBe('lnbc1zapinvoice');
  }, 10000);
});
