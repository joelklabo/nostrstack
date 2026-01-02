type MockEvent = { data?: string; type?: string };

class MockRelayWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockRelayWebSocket.CONNECTING;
  onopen: ((event: MockEvent) => void) | null = null;
  onmessage: ((event: MockEvent) => void) | null = null;
  onerror: ((event: MockEvent) => void) | null = null;
  onclose: ((event: MockEvent) => void) | null = null;
  private listeners: Record<string, Set<(event: MockEvent) => void>> = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set()
  };

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockRelayWebSocket.OPEN;
      this.dispatch('open', { type: 'open' });
    }, 0);
  }

  send() {
    // no-op for mock relay connections
  }

  close() {
    if (this.readyState === MockRelayWebSocket.CLOSED) return;
    this.readyState = MockRelayWebSocket.CLOSED;
    this.dispatch('close', { type: 'close' });
  }

  addEventListener(type: string, handler: (event: MockEvent) => void) {
    this.listeners[type]?.add(handler);
  }

  removeEventListener(type: string, handler: (event: MockEvent) => void) {
    this.listeners[type]?.delete(handler);
  }

  private dispatch(type: string, event: MockEvent) {
    const handler = (this as Record<string, ((event: MockEvent) => void) | null>)[`on${type}`];
    if (typeof handler === 'function') handler(event);
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
  }
}

type WebSocketWindow = Window &
  typeof globalThis & {
    __NOSTRSTACK_MOCK_RELAY_WS__?: boolean;
  };

export function installMockRelayWebSocket() {
  if (typeof window === 'undefined') return;
  const target = window as WebSocketWindow;
  if (target.__NOSTRSTACK_MOCK_RELAY_WS__) return;

  const OriginalWebSocket = target.WebSocket;
  const RelayWebSocket = function (url: string | URL, protocols?: string | string[]) {
    const resolved = typeof url === 'string' ? url : url.toString();
    if (resolved.includes('mock')) {
      return new MockRelayWebSocket(resolved) as unknown as WebSocket;
    }
    return new OriginalWebSocket(resolved, protocols as string | string[] | undefined);
  } as unknown as typeof WebSocket;

  RelayWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  RelayWebSocket.OPEN = OriginalWebSocket.OPEN;
  RelayWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  RelayWebSocket.CLOSED = OriginalWebSocket.CLOSED;
  RelayWebSocket.prototype = OriginalWebSocket.prototype;

  target.WebSocket = RelayWebSocket;
  target.__NOSTRSTACK_MOCK_RELAY_WS__ = true;
}
