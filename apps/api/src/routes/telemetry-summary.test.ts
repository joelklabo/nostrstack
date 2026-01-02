import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerTelemetrySummaryRoute } from './telemetry-summary.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';

describe('/api/telemetry/summary', () => {
  let app: ReturnType<typeof fastify>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });

  beforeEach(async () => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      switch (payload.method) {
        case 'getblockcount':
          return ok(101);
        case 'getblockhash':
          return ok('0'.repeat(64));
        case 'getblock':
          return ok({
            time: 1_700_000_000,
            tx: [],
            size: 1,
            weight: 1
          });
        case 'getmempoolinfo':
          return ok({ size: 5, bytes: 10 });
        case 'getnetworkinfo':
          return ok({ version: 1, subversion: '/Satoshi:0.0.0/', connections: 1 });
        case 'getblockchaininfo':
          return ok({ chain: 'regtest' });
        default:
          return ok(null);
      }
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    app = fastify({ logger: false });
    await registerTelemetrySummaryRoute(app);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it('returns latest block summary', async () => {
    const res = await app.inject({ url: '/api/telemetry/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe('block');
    expect(body.height).toBe(101);
    expect(body.hash).toBe('0'.repeat(64));
    expect(body.network).toBe('regtest');
    expect(body.mempoolTxs).toBe(5);
    expect(body.mempoolBytes).toBe(10);
  });

  it('returns mock summary when rpc fails in dev', async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('rpc down');
    });

    const res = await app.inject({ url: '/api/telemetry/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe('block');
    expect(body.network).toBe('regtest');
    expect(body.height).toBe(820000);
  });
});
