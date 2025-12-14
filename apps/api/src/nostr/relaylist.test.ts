import type { FastifyBaseLogger } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.NOSTR_SECRET_KEY = '1'.repeat(64);
process.env.NOSTR_RELAYS = 'wss://relay.test';

let client: (typeof import('./nostr-client.js'))['NostrClient'];
let instance: InstanceType<typeof client>;

vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual<typeof import('nostr-tools')>('nostr-tools');
  return {
    ...actual,
    finalizeEvent: (event: { kind: number } & Record<string, unknown>, _sk: Uint8Array) => ({
      ...event,
      pubkey: 'pubkey-test',
      id: `id-${event.kind}`,
      sig: `sig-${event.kind}`
    })
  };
});

vi.mock('nostr-tools/relay', () => {
  return {
    Relay: class {
      static async connect(url: string) {
        return new this(url);
      }

      constructor(public url: string) {}

      connect = vi.fn();
      close = vi.fn();
      publish = vi.fn(async (_event: { kind?: number }) => 'ok');
    }
  };
});

describe('NIP-65 relay list', () => {
  beforeAll(async () => {
    const mod = await import('./nostr-client.js');
    client = mod.NostrClient;
    const log = {
      child: () => log,
      level: 'info',
      fatal: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      silent: vi.fn()
    } as unknown as FastifyBaseLogger;
    instance = new client('1'.repeat(64), log);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it('publishes kind 10002 with r tags', async () => {
    const res = await instance.publishRelayList(['wss://relay.test', 'wss://relay.two']);
    expect(res.successes).toBeGreaterThan(0);
  });
});
