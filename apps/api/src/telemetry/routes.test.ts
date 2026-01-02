import fastify from 'fastify';
import client from 'prom-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseEnv: Record<string, string | undefined> = {
  NODE_ENV: 'test',
  VITEST: 'true',
  LOG_LEVEL: 'error',
  BITCOIN_NETWORK: 'mutinynet',
  TELEMETRY_PROVIDER: 'mock',
  LIGHTNING_PROVIDER: 'mock',
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

const buildApp = async (overrides: Record<string, string | undefined> = {}) => {
  applyEnv(overrides);
  client.register.clear();
  vi.resetModules();
  const { registerTelemetryRoutes } = await import('./routes.js');
  const instance = fastify({ logger: false });
  await registerTelemetryRoutes(instance);
  return instance;
};

describe('/api/bitcoin/status', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.unstubAllGlobals();
  });

  it('returns configured network status with mock telemetry', async () => {
    const res = await app.inject({ url: '/api/bitcoin/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.network).toBe('mutinynet');
    expect(body.configuredNetwork).toBe('mutinynet');
    expect(body.source).toBe('mock');
    expect(body.telemetry.network).toBe('mutinynet');
    expect(body.lightning.provider).toBe('mock');
    expect(body.lightning.lnbits.status).toBe('skipped');
  });

  it('falls back to mock telemetry when esplora fails in dev', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('esplora down');
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await app.close();
    app = await buildApp({
      TELEMETRY_PROVIDER: 'esplora',
      TELEMETRY_ESPLORA_URL: 'https://esplora.test',
      BITCOIN_NETWORK: 'mainnet'
    });

    const res = await app.inject({ url: '/api/bitcoin/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('mock');
    expect(body.telemetryError).toContain('esplora down');
    expect(body.telemetry.network).toBe('mainnet');
  });

  it('returns 502 when provider fails in production', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('esplora down');
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await app.close();
    app = await buildApp({
      NODE_ENV: 'production',
      TELEMETRY_PROVIDER: 'esplora',
      TELEMETRY_ESPLORA_URL: 'https://esplora.test',
      BITCOIN_NETWORK: 'mainnet'
    });

    const res = await app.inject({ url: '/api/bitcoin/status' });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error).toBe('bitcoin_status_unavailable');
  });
});
