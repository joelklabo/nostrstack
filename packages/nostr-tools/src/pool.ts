import type { AbortHandle, RelayMessage } from '@rust-nostr/nostr-sdk';
import { Client, Duration, SubscribeAutoCloseOptions } from '@rust-nostr/nostr-sdk';

import { ensureSdk, eventToPlain, toRustEvent, toRustFilter } from './internal.js';
import type { Event, Filter, Subscription } from './types.js';

export type SubscribeManyOptions = {
  onevent?: (event: Event, relayUrl?: string) => void;
  oneose?: (relayUrl?: string) => void;
  onclose?: (reasons: string[]) => void;
  onRelayFailure?: (relayUrl: string, reason?: string) => void;
  maxWait?: number;
};

const shouldReportRelayFailure = (reason: string | undefined) => {
  if (!reason) return false;
  const normalized = reason.trim().toLowerCase();
  return normalized !== 'closed';
};

const RELAY_CONNECT_RETRY_BACKOFF_MS = 10_000;
const RELAY_CONNECT_FAILURE_LOG_WINDOW_MS = 30_000;

type RelayFailureState = {
  nextRetryAt: number;
  reason: string;
  failureCount: number;
  lastWarnedAt: number;
};

type SharedRelayState = {
  relayFailureState: Map<string, RelayFailureState>;
  relayConnectionInFlight: Map<string, Promise<void>>;
};

const RELAY_STATE_KEY = Symbol.for('nostrstack.relayFailureState');
const getSharedRelayState = (): SharedRelayState => {
  const globalScope = globalThis as unknown as {
    [RELAY_STATE_KEY]?: SharedRelayState;
  };
  if (!globalScope[RELAY_STATE_KEY]) {
    globalScope[RELAY_STATE_KEY] = {
      relayFailureState: new Map(),
      relayConnectionInFlight: new Map()
    };
  }
  return globalScope[RELAY_STATE_KEY];
};

let lastAllRelaysFailureLogAt = 0;
const { relayFailureState, relayConnectionInFlight } = getSharedRelayState();

const shouldLogRelayFailure = (url: string, reason: string, now: number) => {
  const existing = relayFailureState.get(url);
  if (!existing || existing.reason !== reason) {
    return true;
  }
  return now - existing.lastWarnedAt >= RELAY_CONNECT_FAILURE_LOG_WINDOW_MS;
};

const getRetryDelayMs = (failureCount: number) => {
  const attempts = Math.min(Math.max(failureCount, 1), 6);
  return RELAY_CONNECT_RETRY_BACKOFF_MS * 2 ** (attempts - 1);
};

const normalizeRelayUrl = (url: string) => url.trim().replace(/\/+$/, '');

const shouldSkipRelayReconnect = (url: string, now: number) => {
  const state = relayFailureState.get(url);
  return Boolean(state && now < state.nextRetryAt);
};

type SubscriptionState = {
  id: string;
  relays: string[];
  eoseRelays: Set<string>;
  options: SubscribeManyOptions;
  timer: ReturnType<typeof setTimeout> | null;
};

let customWebSocketImpl: typeof WebSocket | null = null;

export function useWebSocketImplementation(impl: typeof WebSocket) {
  customWebSocketImpl = impl;
  if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket = impl;
  }
}

export class SimplePool {
  readonly trustedRelayURLs = new Set<string>();
  private readonly client: Client;
  private readonly subscriptions = new Map<string, SubscriptionState>();
  private readonly relays = new Set<string>();
  private abortHandle: AbortHandle | null = null;

  constructor() {
    ensureSdk();
    if (customWebSocketImpl && typeof globalThis !== 'undefined') {
      (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket = customWebSocketImpl;
    }
    this.client = new Client();
    this.startNotifications();
  }

  private startNotifications() {
    if (this.abortHandle) return;
    this.abortHandle = this.client.handleNotifications({
      handleEvent: async (relayUrl, subscriptionId, event) => {
        const sub = this.subscriptions.get(subscriptionId);
        if (!sub) return false;
        sub.options.onevent?.(eventToPlain(event), relayUrl);
        return false;
      },
      handleMsg: async (relayUrl, message) => {
        this.handleRelayMessage(relayUrl, message);
        return false;
      }
    });
  }

  private handleRelayMessage(relayUrl: string, message: RelayMessage) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.asJson());
    } catch {
      return;
    }
    if (!Array.isArray(parsed) || parsed.length < 2) return;
    const [type, subId, ...rest] = parsed;
    if (typeof type !== 'string' || typeof subId !== 'string') return;

    const sub = this.subscriptions.get(subId);
    if (!sub) return;

    if (type === 'EOSE') {
      sub.eoseRelays.add(relayUrl);
      if (sub.eoseRelays.size >= sub.relays.length) {
        sub.options.oneose?.(relayUrl);
      }
      return;
    }

    if (type === 'CLOSED') {
      const reason = typeof rest[0] === 'string' ? rest[0] : 'closed';
      if (shouldReportRelayFailure(reason)) {
        sub.options.onRelayFailure?.(relayUrl, reason);
      }
      sub.options.onclose?.([reason]);
    }
  }

  private async ensureRelays(
    relayUrls: string[]
  ): Promise<{ failed: string[]; succeeded: string[] }> {
    const normalizedInputs = relayUrls.filter(Boolean).map((url) => ({
      input: url,
      normalized: normalizeRelayUrl(url)
    }));
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const { input, normalized } of normalizedInputs) {
      const now = Date.now();
      if (shouldSkipRelayReconnect(normalized, now)) {
        failed.push(input);
        continue;
      }
      if (this.relays.has(normalized)) {
        succeeded.push(normalized);
        continue;
      }

      const inFlight = relayConnectionInFlight.get(normalized);
      if (inFlight) {
        try {
          await inFlight;
          if (this.relays.has(normalized)) {
            succeeded.push(normalized);
            continue;
          }
        } catch {
          failed.push(input);
          continue;
        }
      }

      try {
        const connectPromise = (async () => {
          await this.client.addRelay(normalized);
          this.relays.add(normalized);
          const relay = await this.client.relay(normalized);
          await relay.tryConnect(Duration.fromMillis(BigInt(5000)));
          relayFailureState.delete(normalized);
        })();

        relayConnectionInFlight.set(normalized, connectPromise);
        await connectPromise;
        succeeded.push(normalized);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'connection failed';
        const failureMessage =
          reason.toLowerCase().includes('dns') || reason.toLowerCase().includes('resolve')
            ? `DNS resolution failed for relay ${normalized}: ${reason}`
            : `Failed to connect to relay ${normalized}: ${reason}`;
        await Promise.allSettled([
          this.client.disconnectRelay(normalized),
          this.client.forceRemoveRelay(normalized)
        ]);
        this.relays.delete(normalized);
        const existingState = relayFailureState.get(normalized);
        const failureCount = (existingState?.failureCount ?? 0) + 1;
        const shouldLog = shouldLogRelayFailure(normalized, failureMessage, now);
        if (shouldLog) {
          console.warn(failureMessage);
        }
        relayFailureState.set(normalized, {
          nextRetryAt: now + getRetryDelayMs(failureCount),
          reason: failureMessage,
          failureCount,
          lastWarnedAt: shouldLog ? now : relayFailureState.get(normalized)?.lastWarnedAt ?? now
        });
        failed.push(input);
      } finally {
        relayConnectionInFlight.delete(normalized);
      }
    }

    return { failed, succeeded };
  }

  async connect(relays: string[]): Promise<{ failed: string[]; succeeded: string[] }> {
    return this.ensureRelays(relays);
  }

  async querySync(relays: string[], filter: Filter, opts?: { maxWait?: number }): Promise<Event[]> {
    if (!relays.length) return [];
    const { succeeded } = await this.ensureRelays(relays);
    if (succeeded.length === 0) {
      const now = Date.now();
      if (now - lastAllRelaysFailureLogAt >= RELAY_CONNECT_FAILURE_LOG_WINDOW_MS) {
        lastAllRelaysFailureLogAt = now;
        console.warn('All relays failed to connect, falling back to trying all URLs');
      }
      return [];
    }
    const rustFilter = toRustFilter(filter);
    const timeoutMs = opts?.maxWait ?? 8000;
    const events = await this.client.fetchEventsFrom(
      succeeded,
      rustFilter,
      Duration.fromMillis(BigInt(timeoutMs))
    );
    return events.toVec().map(eventToPlain);
  }

  async get(relays: string[], filter: Filter): Promise<Event | null> {
    if (!relays.length) return null;
    const events = await this.querySync(relays, { ...filter, limit: 1 });
    return events[0] ?? null;
  }

  publish(relays: string[], event: Event): Promise<unknown>[] {
    if (!relays.length) return [];
    const rustEvent = toRustEvent(event);
    return relays.map(async (url) => {
      const { succeeded } = await this.ensureRelays([url]);
      if (succeeded.length === 0) {
        throw new Error(`Failed to connect to relay ${url}`);
      }
      return this.client.sendEventTo([url], rustEvent);
    });
  }

  subscribeMany(relays: string[], filter: Filter, opts: SubscribeManyOptions): Subscription {
    if (!relays.length) {
      return {
        close: (reason?: string) => {
          if (reason) opts.onclose?.([reason]);
        }
      };
    }
    const closeReasons: string[] = [];
    let closed = false;

    const start = async () => {
      const { failed, succeeded } = await this.ensureRelays(relays);
      if (failed.length > 0) {
        failed.forEach((url) => {
          opts.onRelayFailure?.(url, 'connection failed');
        });
      }
      if (succeeded.length === 0) {
        throw new Error('All relays failed to connect');
      }
      const rustFilter = toRustFilter(filter);
      const autoClose = new SubscribeAutoCloseOptions();
      if (typeof opts.maxWait === 'number') {
        autoClose.timeout(Duration.fromMillis(BigInt(opts.maxWait)));
      }
      const output = await this.client.subscribeTo(succeeded, rustFilter, autoClose);
      const subscribedRelays = output.success.length ? output.success : succeeded;
      const state: SubscriptionState = {
        id: output.id,
        relays: subscribedRelays,
        eoseRelays: new Set(),
        options: opts,
        timer: null
      };

      if (typeof opts.maxWait === 'number') {
        state.timer = setTimeout(() => {
          if (closed) return;
          close('timeout');
        }, opts.maxWait);
      }

      this.subscriptions.set(output.id, state);
      return output.id;
    };

    let subscriptionId: string | null = null;

    const close = (reason?: string) => {
      if (closed) return;
      closed = true;
      if (reason) closeReasons.push(reason);
      if (shouldReportRelayFailure(reason)) {
        relays.forEach((relayUrl) => {
          opts.onRelayFailure?.(relayUrl, reason);
        });
      }
      if (subscriptionId) {
        this.subscriptions.delete(subscriptionId);
        void this.client.unsubscribe(subscriptionId);
      }
      opts.onclose?.(closeReasons.length ? closeReasons : ['closed']);
    };

    void start()
      .then((id) => {
        subscriptionId = id;
      })
      .catch((err) => {
        if (err instanceof Error && opts.onRelayFailure) {
          relays.forEach((relayUrl) => {
            opts.onRelayFailure?.(relayUrl, err.message);
          });
        } else if (opts.onRelayFailure) {
          relays.forEach((relayUrl) => {
            opts.onRelayFailure?.(relayUrl, 'subscribe failed');
          });
        }
        closeReasons.push(err instanceof Error ? err.message : 'subscribe failed');
        close('error');
      });

    return { close };
  }

  close(relays: string[]) {
    const normalized = relays.filter(Boolean).map(normalizeRelayUrl);
    normalized.forEach((url) => {
      if (!this.relays.has(url)) return;
      void this.client.disconnectRelay(url);
    });
  }
}
