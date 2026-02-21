type MockRelayEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

type RelayFilter = {
  kinds?: number[];
  authors?: string[];
  ids?: string[];
  '#e'?: string[];
  limit?: number;
};

const INITIAL_EVENTS: MockRelayEvent[] = [
  {
    id: 'e1',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 1,
    tags: [],
    content: 'Hello Nostr! This is a mock post from Alice.',
    sig: 'sig1'
  },
  {
    id: 'e2',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000002',
    created_at: Math.floor(Date.now() / 1000) - 1800,
    kind: 1,
    tags: [],
    content: 'Nostr is amazing. This is Bob reporting in.',
    sig: 'sig2'
  },
  {
    id: 'e3',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    created_at: Math.floor(Date.now() / 1000) - 900,
    kind: 1,
    tags: [['e', 'e2', '', 'reply']],
    content: 'I agree, Bob!',
    sig: 'sig3'
  },
  {
    id: 'p1',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    created_at: Math.floor(Date.now() / 1000) - 7200,
    kind: 0,
    tags: [],
    content: JSON.stringify({
      name: 'Alice',
      about: 'Mock Alice',
      picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      lud16: 'alice@nostr.com'
    }),
    sig: 'sigp1'
  },
  {
    id: 'p2',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000002',
    created_at: Math.floor(Date.now() / 1000) - 7200,
    kind: 0,
    tags: [],
    content: JSON.stringify({
      name: 'Bob',
      about: 'Mock Bob',
      picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      lud16: 'bob@nostr.com'
    }),
    sig: 'sigp2'
  }
];

type WebSocketWindow = Window &
  typeof globalThis & {
    __NOSTRSTACK_MOCK_RELAY_WS__?: boolean;
  };

type MockRelayWindow = WebSocketWindow & {
  __NOSTRSTACK_MOCK_EVENTS__?: MockRelayEvent[];
};

export function installMockRelayWebSocket() {
  if (typeof window === 'undefined') return;
  const target = window as WebSocketWindow;
  if (target.__NOSTRSTACK_MOCK_RELAY_WS__) return;

  const OriginalWebSocket = target.WebSocket;

  class MockRelayWebSocket extends EventTarget {
    [key: string]: unknown;

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    url: string;
    readyState = MockRelayWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: Event) => void) | null = null;

    constructor(url: string) {
      super();
      this.url = url;
      setTimeout(() => {
        this.readyState = MockRelayWebSocket.OPEN;
        const openEvent = new Event('open');
        if (this.onopen) this.onopen(openEvent);
        this.dispatchEvent(openEvent);
      }, 20);
    }

    send(data: string) {
      try {
        if (this.url.includes('/ws/telemetry')) {
          setTimeout(() => {
            this.dispatchMessage({
              type: 'block',
              height: 100000,
              hash: '0000000000000000000000000000000000000000000000000000000000000000',
              time: Math.floor(Date.now() / 1000),
              tx_count: 50,
              size: 1000000,
              weight: 4000000
            });
          }, 100);
          return;
        }

        if (this.url.includes('/ws/wallet')) {
          setTimeout(() => {
            this.dispatchMessage({
              id: 'mock-wallet',
              name: 'Mock Wallet',
              balance: 1000000
            });
          }, 100);
          return;
        }

        const msg = JSON.parse(data) as unknown;
        if (Array.isArray(msg) && msg[0] === 'EVENT') {
          const event = msg[1] as MockRelayEvent;
          setTimeout(() => {
            this.dispatchMessage(['OK', event.id, true, '']);
            const target = window as MockRelayWindow;
            if (!target.__NOSTRSTACK_MOCK_EVENTS__)
              target.__NOSTRSTACK_MOCK_EVENTS__ = [...INITIAL_EVENTS];
            if (!target.__NOSTRSTACK_MOCK_EVENTS__.some((entry) => entry.id === event.id)) {
              target.__NOSTRSTACK_MOCK_EVENTS__.push(event);
            }
            window.dispatchEvent(new CustomEvent('nostrstack:mock-event', { detail: event }));
          }, 10);
        } else if (Array.isArray(msg) && msg[0] === 'REQ') {
          const subId = msg[1];
          const filters = msg.slice(2) as RelayFilter[];
          console.log(`[MockRelay] REQ received: ${subId}`, filters);

          const target = window as MockRelayWindow;
          const allEvents = target.__NOSTRSTACK_MOCK_EVENTS__ ?? [...INITIAL_EVENTS];
          target.__NOSTRSTACK_MOCK_EVENTS__ = allEvents;

          const matches: MockRelayEvent[] = [];
          for (const filter of filters) {
            const filterMatches = allEvents.filter((event) => {
              if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
              if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
              if (filter.ids && !filter.ids.includes(event.id)) return false;
              const tagFilter = filter['#e'];
              if (tagFilter && !event.tags.some((t) => t[0] === 'e' && tagFilter.includes(t[1]))) {
                return false;
              }
              return true;
            });
            matches.push(...filterMatches);
          }

          const uniqueMatches = Array.from(new Map(matches.map((m) => [m.id, m])).values());
          uniqueMatches.sort((a, b) => b.created_at - a.created_at);

          const limit = filters.reduce((min, filter) => Math.min(min, filter.limit || 1000), 1000);
          const limitedMatches = uniqueMatches.slice(0, limit);

          const handler = (e: Event) => {
            if (this.readyState !== MockRelayWebSocket.OPEN) {
              window.removeEventListener('nostrstack:mock-event', handler as EventListener);
              return;
            }
            const event = (e as CustomEvent<MockRelayEvent>).detail;
            const matchesFilter = filters.some((filter) => {
              if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
              if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
              if (filter.ids && !filter.ids.includes(event.id)) return false;
              return true;
            });

            if (matchesFilter) {
              this.dispatchMessage(['EVENT', subId, event]);
            }
          };
          window.addEventListener('nostrstack:mock-event', handler as EventListener);
          this.addEventListener('close', () => {
            window.removeEventListener('nostrstack:mock-event', handler as EventListener);
          });

          setTimeout(() => {
            for (const event of limitedMatches) {
              this.dispatchMessage(['EVENT', subId, event]);
            }
            this.dispatchMessage(['EOSE', subId]);
          }, 50);
        }
      } catch (e) {
        console.error('MockRelay error', e);
      }
    }

    close() {
      if (this.readyState === MockRelayWebSocket.CLOSED) return;
      this.readyState = MockRelayWebSocket.CLOSED;
      const closeEvent = new Event('close');
      if (this.onclose) this.onclose(closeEvent);
      this.dispatchEvent(closeEvent);
    }

    private dispatchMessage(data: unknown) {
      const label = Array.isArray(data) ? data[0] : 'data';
      console.log(`[MockRelay] Sending message to ${this.url}:`, label);
      const event = new MessageEvent<string>('message', {
        data: JSON.stringify(data),
        origin: this.url
      });
      if (this.onmessage) this.onmessage(event);
      this.dispatchEvent(event);
    }
  }

  const RelayWebSocketProxy = function (url: string | URL, protocols?: string | string[]) {
    const resolved = typeof url === 'string' ? url : url.toString();
    if (
      resolved.includes('mock') ||
      resolved.includes('/ws/telemetry') ||
      resolved.includes('/ws/wallet')
    ) {
      return new MockRelayWebSocket(resolved);
    }
    return new OriginalWebSocket(resolved, protocols as string | string[] | undefined);
  };

  RelayWebSocketProxy.prototype = OriginalWebSocket.prototype;
  Object.assign(RelayWebSocketProxy, {
    CONNECTING: OriginalWebSocket.CONNECTING,
    OPEN: OriginalWebSocket.OPEN,
    CLOSING: OriginalWebSocket.CLOSING,
    CLOSED: OriginalWebSocket.CLOSED
  });

  target.WebSocket = RelayWebSocketProxy as unknown as typeof WebSocket;
  target.__NOSTRSTACK_MOCK_RELAY_WS__ = true;
}
