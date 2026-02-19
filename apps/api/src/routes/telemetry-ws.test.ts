import fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseEnv: Record<string, string | undefined> = {
  NODE_ENV: 'test',
  VITEST: 'true',
  LOG_LEVEL: 'error',
  TELEMETRY_PROVIDER: 'bitcoind'
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

const buildApp = async (fetchMock: ReturnType<typeof vi.fn>) => {
  applyEnv({});
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  const { registerTelemetryWs } = await import('./telemetry-ws.js');
  const client = (await import('prom-client')).default;
  client.register.clear();
  const instance = fastify({ logger: false });
  return { instance, registerTelemetryWs };
};

describe('telemetry ws polling', () => {
  let app: FastifyInstance;
  let fetchMock: ReturnType<typeof vi.fn>;
  let getblockcountCalls = 0;
  let logInfo: ReturnType<typeof vi.fn>;
  let logWarn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    getblockcountCalls = 0;

    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      switch (payload.method) {
        case 'getblockcount': {
          getblockcountCalls += 1;
          if (getblockcountCalls === 1) return ok(101);
          return new Response('Work queue depth exceeded', { status: 503 });
        }
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
          return ok({ size: 0, bytes: 0 });
        case 'getnetworkinfo':
          return ok({ version: 1, subversion: '/Satoshi:0.0.0/', connections: 1 });
        case 'getblockchaininfo':
          return ok({ chain: 'regtest' });
        default:
          return ok(null);
      }
    });

    const result = await buildApp(fetchMock);
    app = result.instance;
    logInfo = vi.fn();
    logWarn = vi.fn();
    Object.assign(app.log, { info: logInfo, warn: logWarn });

    await result.registerTelemetryWs(app);
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('backs off polling after 503 responses', async () => {
    await vi.advanceTimersByTimeAsync(5000);
    expect(getblockcountCalls).toBe(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(getblockcountCalls).toBe(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(getblockcountCalls).toBe(3);
  });

  it('logs backpressure at info level', async () => {
    await vi.advanceTimersByTimeAsync(5000);
    expect(logInfo).toHaveBeenCalled();
    expect(logWarn).not.toHaveBeenCalled();
  });
});
