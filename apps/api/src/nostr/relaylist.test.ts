import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.NOSTR_SECRET_KEY = '1'.repeat(64);
process.env.NOSTR_RELAYS = 'wss://relay.test';

let client: (typeof import('./nostr-client.js'))['NostrClient'];
let instance: InstanceType<typeof client>;

vi.mock('nostr-tools', async () => {
  const actual = await vi.importActual<any>('nostr-tools');
  return {
    ...actual,
    finalizeEvent: (event: any, _sk: string) => ({
      ...event,
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
      publish(event: any) {
        return {
          on: (evt: string, cb: Function) => {
            if (evt === 'ok') cb();
          }
        };
      }
    }
  };
});

describe('NIP-65 relay list', () => {
  beforeAll(async () => {
    const mod = await import('./nostr-client.js');
    client = mod.NostrClient;
    instance = new client('1'.repeat(64), console as any);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it('publishes kind 10002 with r tags', async () => {
    const res = await instance.publishRelayList(['wss://relay.test', 'wss://relay.two']);
    expect(res.successes).toBeGreaterThan(0);
  });
});
