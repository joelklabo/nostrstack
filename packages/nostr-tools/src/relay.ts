import { SimplePool, type SubscribeManyOptions } from './pool.js';
import type { Event, Filter, Subscription } from './types.js';

export type RelaySub = {
  on: (event: 'event' | 'eose' | 'notice', handler: (payload?: Event) => void) => RelaySub;
  close: () => void;
};

export class Relay {
  readonly url: string;
  _connected = false;
  private readonly pool: SimplePool;

  constructor(url: string, pool: SimplePool) {
    this.url = url;
    this.pool = pool;
  }

  static async connect(url: string): Promise<Relay> {
    const pool = new SimplePool();
    const relay = new Relay(url, pool);
    await relay.connect();
    return relay;
  }

  async connect(): Promise<void> {
    if (this._connected) return;
    await this.pool.connect([this.url]);
    this._connected = true;
  }

  close(): void {
    this.pool.close([this.url]);
    this._connected = false;
  }

  async publish(event: Event): Promise<void> {
    await Promise.allSettled(this.pool.publish([this.url], event));
  }

  subscribe(filters: Filter[], opts: SubscribeManyOptions): Subscription {
    const subs = filters.map((filter) => this.pool.subscribeMany([this.url], filter, opts));
    return {
      close: () => subs.forEach((s) => s.close('relay-close'))
    };
  }

  sub(filters: Filter[]): RelaySub {
    const handlers: {
      event: Array<(ev: Event) => void>;
      eose: Array<() => void>;
      notice: Array<() => void>;
    } = {
      event: [],
      eose: [],
      notice: []
    };

    const subscription = this.subscribe(filters, {
      onevent: (event) => handlers.event.forEach((h) => h(event)),
      oneose: () => handlers.eose.forEach((h) => h()),
      onclose: () => handlers.notice.forEach((h) => h())
    });

    const api: RelaySub = {
      on: (event, handler) => {
        handlers[event].push(handler as (ev?: Event) => void);
        return api;
      },
      close: () => subscription.close('relay-sub-close')
    };

    return api;
  }
}

export function relayInit(url: string): Relay {
  const pool = new SimplePool();
  return new Relay(url, pool);
}
