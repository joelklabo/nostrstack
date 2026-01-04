import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelemetryBar } from './TelemetryBar';

const { refreshSpy, subscribeSpy } = vi.hoisted(() => ({
  refreshSpy: vi.fn(),
  subscribeSpy: vi.fn(() => () => {})
}));

vi.mock('@nostrstack/blog-kit', () => ({
  subscribeTelemetry: subscribeSpy,
  useBitcoinStatus: () => ({
    status: null,
    error: null,
    isLoading: false,
    refresh: refreshSpy
  })
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private openListeners: Array<() => void> = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'open') {
      this.openListeners.push(listener as () => void);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'open') {
      this.openListeners = this.openListeners.filter(current => current !== listener);
    }
  }

  send() {
    // no-op
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    this.onclose?.({ code: 1000 } as CloseEvent);
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
    this.openListeners.forEach(listener => listener());
  }

  triggerClose(event: Partial<CloseEvent> = {}) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, ...event } as CloseEvent);
  }
}

const originalWebSocket = globalThis.WebSocket;

const getLatestSocket = () => {
  const socket = MockWebSocket.instances.at(-1);
  if (!socket) throw new Error('Expected WebSocket instance to be created');
  return socket;
};

const getStatusElement = () => {
  const element = document.querySelector('.telemetry-status');
  if (!element) throw new Error('Expected telemetry status element to be present');
  return element as HTMLElement;
};

const expectStatus = (status: string) => {
  expect(getStatusElement().dataset.status).toBe(status);
};

const advanceTimers = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  delete (window as typeof window & { __NOSTRSTACK_TELEMETRY_TIMING__?: unknown }).__NOSTRSTACK_TELEMETRY_TIMING__;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.WebSocket = originalWebSocket;
  delete (window as typeof window & { __NOSTRSTACK_TELEMETRY_TIMING__?: unknown }).__NOSTRSTACK_TELEMETRY_TIMING__;
});

describe('TelemetryBar', () => {
  it('delays reconnecting status until dwell elapses', async () => {
    render(<TelemetryBar />);
    const socket = getLatestSocket();

    act(() => {
      socket.triggerClose({ code: 1006 });
    });

    expectStatus('connecting');

    await advanceTimers(399);
    expectStatus('connecting');

    await advanceTimers(1);
    expectStatus('reconnecting');
  });

  it('resets dwell when status flaps to offline', async () => {
    render(<TelemetryBar />);
    const socket = getLatestSocket();

    act(() => {
      socket.triggerClose({ code: 1006 });
    });

    await advanceTimers(200);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      await Promise.resolve();
    });

    expectStatus('connecting');

    await advanceTimers(399);
    expectStatus('connecting');

    await advanceTimers(1);
    expectStatus('offline');
  });

  it('shows connected immediately and cancels dwell', async () => {
    render(<TelemetryBar />);
    const socket = getLatestSocket();

    act(() => {
      socket.triggerClose({ code: 1006 });
    });

    await advanceTimers(200);

    await act(async () => {
      socket.triggerOpen();
      await Promise.resolve();
    });

    expectStatus('connected');

    await advanceTimers(400);
    expectStatus('connected');
  });

  it.each([
    ['zero', 0],
    ['negative', -200]
  ])('disables dwell when statusDwellMs is %s', async (_label, dwellMs) => {
    (window as typeof window & { __NOSTRSTACK_TELEMETRY_TIMING__?: unknown })
      .__NOSTRSTACK_TELEMETRY_TIMING__ = { statusDwellMs: dwellMs };

    render(<TelemetryBar />);
    const socket = getLatestSocket();

    act(() => {
      socket.triggerClose({ code: 1006 });
    });

    await advanceTimers(0);
    expectStatus('reconnecting');
  });

  it('clears dwell timers on unmount', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<TelemetryBar />);
    const socket = getLatestSocket();

    act(() => {
      socket.triggerClose({ code: 1006 });
    });

    unmount();

    await advanceTimers(400);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
