import fastify from 'fastify';
import client from 'prom-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseEnv: Record<string, string | undefined> = {
  NODE_ENV: 'test',
  VITEST: 'true',
  LOG_LEVEL: 'error',
  BITCOIN_NETWORK: 'regtest',
  TELEMETRY_PROVIDER: 'bitcoind',
  TELEMETRY_ESPLORA_URL: undefined
};

const applyEnv = (overrides: Record<string, string | undefined> = {}) => {
  const env = { ...baseEnv, ...overrides };
  const keys = new Set([...Object.keys(baseEnv), ...Object.keys(overrides)]);
  for (const key of keys) {
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });
const json = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });
const text = (payload: string) => new Response(payload, { status: 200 });

const buildBitcoindFetch = () =>
  vi.fn(async (_url: string, init?: RequestInit) => {
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

const buildEsploraFetch = () =>
  vi.fn(async (url: string) => {
    switch (url) {
      case 'https://esplora.test/blocks/tip/height':
        return text('999');
      case 'https://esplora.test/blocks/tip/hash':
        return text('hash999');
      case 'https://esplora.test/block-height/999':
        return text('hash999');
      case 'https://esplora.test/block/hash999':
        return json({ timestamp: 1_700_000_000, tx_count: 3, size: 9, weight: 18 });
      case 'https://esplora.test/mempool':
        return json({ count: 4, vsize: 11 });
      default:
        return new Response('not found', { status: 404 });
    }
  });

const buildApp = async (
  overrides: Record<string, string | undefined>,
  fetchMock: ReturnType<typeof vi.fn>
) => {
  applyEnv(overrides);
  client.register.clear();
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  const { registerTelemetrySummaryRoute } = await import('./telemetry-summary.js');
  const instance = fastify({ logger: false });
  await registerTelemetrySummaryRoute(instance);
  return instance;
};

describe('/api/telemetry/summary', () => {
  let app: ReturnType<typeof fastify>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = buildBitcoindFetch();
    app = await buildApp({}, fetchMock);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.unstubAllGlobals();
  });

  it('returns latest block summary', async () => {
    const res = await app.inject({ url: '/api/telemetry/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe('block');
    expect(body.source).toBe('bitcoind');
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
    expect(body.source).toBe('mock');
    expect(body.network).toBe('regtest');
    expect(body.height).toBe(820000);
  });

  it('uses esplora provider when configured', async () => {
    await app.close();
    fetchMock = buildEsploraFetch();
    app = await buildApp(
      {
        TELEMETRY_PROVIDER: 'esplora',
        TELEMETRY_ESPLORA_URL: 'https://esplora.test',
        BITCOIN_NETWORK: 'mutinynet'
      },
      fetchMock
    );

    const res = await app.inject({ url: '/api/telemetry/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('esplora');
    expect(body.network).toBe('mutinynet');
    expect(body.height).toBe(999);
  });

  it('falls back to mock when esplora fails in dev', async () => {
    await app.close();
    fetchMock = vi.fn(async () => {
      throw new Error('esplora down');
    });
    app = await buildApp(
      {
        TELEMETRY_PROVIDER: 'esplora',
        TELEMETRY_ESPLORA_URL: 'https://esplora.test',
        BITCOIN_NETWORK: 'mutinynet'
      },
      fetchMock
    );

    const res = await app.inject({ url: '/api/telemetry/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('mock');
    expect(body.network).toBe('mutinynet');
    expect(body.height).toBe(820000);
  });
});
