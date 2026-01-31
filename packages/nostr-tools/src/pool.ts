import type { AbortHandle, RelayMessage } from '@rust-nostr/nostr-sdk';
import { Client, Duration, SubscribeAutoCloseOptions } from '@rust-nostr/nostr-sdk';

import { ensureSdk, eventToPlain, toRustEvent, toRustFilter } from './internal.js';
import type { Event, Filter, Subscription } from './types.js';

export type SubscribeManyOptions = {
  onevent?: (event: Event, relayUrl?: string) => void;
  oneose?: (relayUrl?: string) => void;
  onclose?: (reasons: string[]) => void;
  maxWait?: number;
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
      sub.options.onclose?.([reason]);
    }
  }

  private async ensureRelays(relayUrls: string[]) {
    const unique = relayUrls.filter(Boolean);
    for (const url of unique) {
      if (this.relays.has(url)) continue;
      await this.client.addRelay(url);
      this.relays.add(url);
      await this.client.connectRelay(url);
    }
  }

  async connect(relays: string[]): Promise<void> {
    await this.ensureRelays(relays);
  }

  async querySync(relays: string[], filter: Filter, opts?: { maxWait?: number }): Promise<Event[]> {
    if (!relays.length) return [];
    await this.ensureRelays(relays);
    const rustFilter = toRustFilter(filter);
    const timeoutMs = opts?.maxWait ?? 8000;
    const events = await this.client.fetchEventsFrom(
      relays,
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
      await this.ensureRelays([url]);
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
      await this.ensureRelays(relays);
      const rustFilter = toRustFilter(filter);
      const autoClose = new SubscribeAutoCloseOptions();
      if (typeof opts.maxWait === 'number') {
        autoClose.timeout(Duration.fromMillis(BigInt(opts.maxWait)));
      }
      const output = await this.client.subscribeTo(relays, rustFilter, autoClose);
      const state: SubscriptionState = {
        id: output.id,
        relays: output.success.length ? output.success : relays,
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
        closeReasons.push(err instanceof Error ? err.message : 'subscribe failed');
        close('error');
      });

    return { close };
  }

  close(relays: string[]) {
    relays.forEach((url) => {
      if (!this.relays.has(url)) return;
      void this.client.disconnectRelay(url);
    });
  }
}
