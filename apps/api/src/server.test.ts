import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.OP_NODE_API_KEY = 'test-key';
process.env.USE_HTTPS = 'false';
process.env.PUBLIC_ORIGIN = 'http://localhost:3001';

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { buildServer as buildServerFn } from './server.js';

let server: Awaited<ReturnType<typeof buildServerFn>>;

describe('server', () => {
  beforeAll(async () => {
    process.env.VITEST = 'true';
    process.env.NODE_ENV = 'test';
    const dbUrl = process.env.TEST_DATABASE_URL ?? 'file:./tmp-test.db';
    process.env.DATABASE_URL = dbUrl;
    process.env.LOG_LEVEL = 'warn';
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    const pushCmd = `./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`;
    execSync(pushCmd, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    const { buildServer } = await import('./server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('responds to /health', async () => {
    const res = await server.inject({ url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('responds to /api/health', async () => {
    const res = await server.inject({ url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });
});
