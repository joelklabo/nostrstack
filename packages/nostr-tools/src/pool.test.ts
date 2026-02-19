import { beforeEach, describe, expect, it, vi } from 'vitest';

const RELAY_STATE_KEY = Symbol.for('nostrstack.relayFailureState');

vi.mock('@rust-nostr/nostr-sdk', async () => {
  const mockRelay = {
    tryConnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined)
  };

  const mockClient = {
    addRelay: vi.fn().mockResolvedValue(undefined),
    relay: vi.fn().mockImplementation((_url: string) => Promise.resolve(mockRelay)),
    disconnectRelay: vi.fn().mockResolvedValue(undefined),
    forceRemoveRelay: vi.fn().mockResolvedValue(undefined),
    handleNotifications: vi.fn().mockReturnValue({}),
    fetchEventsFrom: vi.fn().mockResolvedValue({
      toVec: () => []
    }),
    sendEventTo: vi.fn().mockResolvedValue(undefined),
    subscribeTo: vi.fn().mockResolvedValue({ id: 'sub-id', success: [] }),
    unsubscribe: vi.fn().mockResolvedValue(undefined)
  };

  return {
    Client: vi.fn(() => mockClient),
    Duration: {
      fromMillis: (ms: bigint) => ms
    },
    SubscribeAutoCloseOptions: vi.fn()
  };
});

vi.mock('./internal.js', async () => {
  return {
    ensureSdk: vi.fn(),
    eventToPlain: vi.fn((e: unknown) => e),
    toRustEvent: vi.fn((e: unknown) => e),
    toRustFilter: vi.fn((f: unknown) => f)
  };
});

describe('SimplePool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const globalScope = globalThis as Record<symbol, unknown>;
    delete globalScope[RELAY_STATE_KEY];
  });

  describe('ensureRelays concurrency', () => {
    it('connects to multiple relays in parallel - one failing does not block others', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      client.client.addRelay.mockImplementation(async (url: string) => {
        if (url.includes('failing')) {
          throw new Error('Connection refused');
        }
      });

      const result = await pool.connect([
        'wss://relay-one.com',
        'wss://failing-relay.com',
        'wss://relay-two.com'
      ]);

      expect(result.succeeded).toContain('wss://relay-one.com');
      expect(result.succeeded).toContain('wss://relay-two.com');
      expect(result.failed).toContain('wss://failing-relay.com');
    });

    it('does not make duplicate connection attempts for same relay in parallel', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      let addRelayCallCount = 0;

      client.client.addRelay.mockImplementation(async () => {
        addRelayCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const results = await Promise.all([
        pool.connect(['wss://relay-one.com']),
        pool.connect(['wss://relay-one.com']),
        pool.connect(['wss://relay-one.com'])
      ]);

      expect(addRelayCallCount).toBe(1);
      results.forEach((result) => {
        expect(result.succeeded).toContain('wss://relay-one.com');
      });
    });

    it('shares in-flight connection between concurrent connect calls for same relay', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      let activeConnections = 0;
      let maxConcurrent = 0;

      client.client.addRelay.mockImplementation(async () => {
        activeConnections++;
        maxConcurrent = Math.max(maxConcurrent, activeConnections);
        await new Promise((resolve) => setTimeout(resolve, 100));
        activeConnections--;
      });

      const connectPromise1 = pool.connect(['wss://shared-relay.com']);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const connectPromise2 = pool.connect(['wss://shared-relay.com']);

      await Promise.all([connectPromise1, connectPromise2]);

      expect(maxConcurrent).toBe(1);
    });
  });

  describe('ensureRelays backoff behavior', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('skips relay connection during backoff window after failure', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      client.client.addRelay.mockImplementation(async (url: string) => {
        if (url.includes('failing')) {
          throw new Error('Connection refused');
        }
      });

      const firstResult = await pool.connect(['wss://failing-relay.com']);
      expect(firstResult.failed).toContain('wss://failing-relay.com');
      expect(firstResult.succeeded).toHaveLength(0);
      expect(client.client.addRelay).toHaveBeenCalledTimes(1);

      const secondResult = await pool.connect(['wss://failing-relay.com']);
      expect(secondResult.failed).toContain('wss://failing-relay.com');
      expect(client.client.addRelay).toHaveBeenCalledTimes(1);
    });

    it('allows connection after backoff window expires', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      let attemptCount = 0;
      client.client.addRelay.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Connection refused');
        }
      });

      const firstResult = await pool.connect(['wss://initially-failing.com']);
      expect(firstResult.failed).toContain('wss://initially-failing.com');

      const globalScope = globalThis as Record<symbol, unknown>;
      const state = globalScope[RELAY_STATE_KEY] as
        | {
            relayFailureState: Map<string, { nextRetryAt: number }>;
          }
        | undefined;
      const relayState = state?.relayFailureState?.get('wss://initially-failing.com');
      if (relayState) {
        relayState.nextRetryAt = 0;
      }

      const secondResult = await pool.connect(['wss://initially-failing.com']);
      expect(secondResult.succeeded).toContain('wss://initially-failing.com');
      expect(attemptCount).toBe(2);
    });

    it('tracks failure count across connection attempts', async () => {
      const { SimplePool } = await import('./pool.js');
      const pool = new SimplePool();

      const client = pool as unknown as { client: { addRelay: ReturnType<typeof vi.fn> } };
      let callCount = 0;
      client.client.addRelay.mockImplementation(async () => {
        callCount++;
        throw new Error('Connection refused');
      });

      await pool.connect(['wss://backoff-test.com']);
      expect(callCount).toBe(1);

      const globalScope = globalThis as Record<symbol, unknown>;
      const state = globalScope[RELAY_STATE_KEY] as
        | {
            relayFailureState: Map<string, { nextRetryAt: number; failureCount: number }>;
          }
        | undefined;
      const relayState = state?.relayFailureState?.get('wss://backoff-test.com');

      expect(relayState).toBeDefined();
      expect(relayState?.failureCount).toBe(1);
    });
  });
});
