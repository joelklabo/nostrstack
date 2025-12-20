import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { secp256k1 } from '@noble/curves/secp256k1';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { buildServer as buildServerFn } from '../server.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-lnurl-auth.db';
process.env.ENABLE_LNURL_AUTH = 'true';

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('lnurl-auth routes', () => {
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

  it('creates request + reports status after verification', async () => {
    const res = await server.inject({ url: '/api/lnurl-auth/request' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { k1: string; lnurl: string };
    expect(body.k1).toHaveLength(64);
    expect(body.lnurl).toBeTruthy();

    const privkey = secp256k1.utils.randomPrivateKey();
    const pubkey = secp256k1.getPublicKey(privkey, true);
    const sig = secp256k1.sign(Buffer.from(body.k1, 'hex'), privkey).toCompactRawBytes();
    const sigHex = Buffer.from(sig).toString('hex');
    const keyHex = Buffer.from(pubkey).toString('hex');

    const cb = await server.inject({
      url: `/api/lnurl-auth/callback?tag=login&k1=${body.k1}&sig=${sigHex}&key=${keyHex}`
    });
    expect(cb.statusCode).toBe(200);
    expect(cb.json()).toEqual({ status: 'OK' });

    const statusRes = await server.inject({ url: `/api/lnurl-auth/status/${body.k1}` });
    expect(statusRes.statusCode).toBe(200);
    const statusBody = statusRes.json() as { status: string; linkingKey: string | null };
    expect(statusBody.status).toBe('VERIFIED');
    expect(statusBody.linkingKey).toBe(keyHex);
  });

  it('rejects invalid signatures', async () => {
    const res = await server.inject({ url: '/api/lnurl-auth/request' });
    const body = res.json() as { k1: string };

    const privkey = secp256k1.utils.randomPrivateKey();
    const pubkey = secp256k1.getPublicKey(privkey, true);
    const sig = secp256k1.sign(Buffer.from(body.k1, 'hex'), secp256k1.utils.randomPrivateKey()).toCompactRawBytes();
    const sigHex = Buffer.from(sig).toString('hex');
    const keyHex = Buffer.from(pubkey).toString('hex');

    const cb = await server.inject({
      url: `/api/lnurl-auth/callback?tag=login&k1=${body.k1}&sig=${sigHex}&key=${keyHex}`
    });
    expect(cb.statusCode).toBe(400);
    expect(cb.json().status).toBe('ERROR');
  });
});
