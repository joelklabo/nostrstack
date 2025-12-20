import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import client from 'prom-client';
import { describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-regtest-fund.db';
process.env.LIGHTNING_PROVIDER = 'mock';
process.env.OP_NODE_WEBHOOK_SECRET = '';

const schema = resolve(process.cwd(), 'prisma/schema.prisma');
execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  }
);

describe('regtest fund route', () => {
  it('returns 404 when regtest fund is disabled', async () => {
    process.env.ENABLE_REGTEST_FUND = 'false';
    vi.resetModules();
    client.register.clear();
    const { buildServer } = await import('../server.js');
    const server = await buildServer();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/regtest/fund'
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ ok: false, error: 'regtest_fund_disabled' });
    } finally {
      await server.close();
    }
  });
});
