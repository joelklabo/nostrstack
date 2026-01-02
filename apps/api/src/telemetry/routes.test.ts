import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/bitcoin/status', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
    process.env.LOG_LEVEL = 'error';
    process.env.BITCOIN_NETWORK = 'mutinynet';
    process.env.TELEMETRY_PROVIDER = 'mock';
    process.env.LIGHTNING_PROVIDER = 'mock';

    vi.resetModules();
    const { registerTelemetryRoutes } = await import('./routes.js');
    app = fastify({ logger: false });
    await registerTelemetryRoutes(app);
  });

  afterEach(async () => {
    await app.close();
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
});
