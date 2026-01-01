import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerTelemetryWs } from './telemetry-ws.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';

describe('telemetry ws polling', () => {
  let app: ReturnType<typeof fastify>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let getblockcountCalls = 0;
  let logInfo: ReturnType<typeof vi.fn>;
  let logWarn: ReturnType<typeof vi.fn>;

  const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });

  beforeEach(async () => {
    vi.useFakeTimers();
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

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    app = fastify({ logger: false });
    logInfo = vi.fn();
    logWarn = vi.fn();
    Object.assign(app.log, { info: logInfo, warn: logWarn });

    await registerTelemetryWs(app);
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
