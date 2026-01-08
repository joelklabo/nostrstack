import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-cors.db';
process.env.PUBLIC_ORIGIN = 'https://public.example';
process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example';

const allowedOrigin = 'https://allowed.example';
const blockedOrigin = 'https://blocked.example';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import for type inference
type Server = Awaited<ReturnType<(typeof import('./server.js'))['buildServer']>>;
let server: Server;

describe('CORS allowlist', () => {
  beforeAll(async () => {
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    execSync(
      `./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      }
    );
    const { buildServer } = await import('./server.js');
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('allows allowlisted origin', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: allowedOrigin }
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
  });

  it('does not allow disallowed origin', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: blockedOrigin }
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
