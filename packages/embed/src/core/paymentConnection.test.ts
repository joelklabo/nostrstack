import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConnectionState, PaymentConnection } from './paymentConnection.js';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

// Mock fetch
const mockFetch = vi.fn();

describe('PaymentConnection', () => {
  let originalWebSocket: typeof WebSocket;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    originalFetch = global.fetch;
    // @ts-expect-error - mocking WebSocket
    global.WebSocket = MockWebSocket;
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: 'test.com'
      });

      expect(conn.getState()).toBe('idle');
      expect(conn.hasPaid()).toBe(false);
    });

    it('should handle null wsUrl', () => {
      const conn = new PaymentConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        domain: null
      });

      conn.start();
      expect(conn.getState()).toBe('idle');
    });
  });

  describe('WebSocket connection', () => {
    it('should transition to connecting state when started', () => {
      const states: ConnectionState[] = [];
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onStateChange: (state) => states.push(state)
      });

      conn.start();
      expect(states).toContain('connecting');
    });

    it('should transition to open state after connection', async () => {
      const states: ConnectionState[] = [];
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onStateChange: (state) => states.push(state)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      expect(states).toContain('open');
    });
  });

  describe('payment detection', () => {
    it('should call onPaid when payment is detected via WebSocket', async () => {
      const onPaid = vi.fn();
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onPaid
      });

      conn.setInvoice('lnbc1test123', 'ref-123');
      conn.start();

      await vi.advanceTimersByTimeAsync(20);

      // Get the WebSocket instance and simulate a message
      // @ts-expect-error - accessing private property for testing
      const ws = conn.ws as MockWebSocket;
      ws.simulateMessage({
        type: 'invoice-paid',
        pr: 'lnbc1test123',
        providerRef: 'ref-123'
      });

      expect(onPaid).toHaveBeenCalled();
      expect(conn.hasPaid()).toBe(true);
    });

    it('should detect payment via status message', async () => {
      const onPaid = vi.fn();
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onPaid
      });

      conn.setInvoice('lnbc1test456', 'ref-456');
      conn.start();

      await vi.advanceTimersByTimeAsync(20);

      // @ts-expect-error - accessing private property for testing
      const ws = conn.ws as MockWebSocket;
      ws.simulateMessage({
        type: 'invoice-status',
        status: 'PAID',
        provider_ref: 'ref-456'
      });

      expect(onPaid).toHaveBeenCalled();
    });

    it('should normalize invoice with lightning: prefix', async () => {
      const onPaid = vi.fn();
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onPaid
      });

      conn.setInvoice('lightning:LNBC1TEST789', null);
      conn.start();

      await vi.advanceTimersByTimeAsync(20);

      // @ts-expect-error - accessing private property for testing
      const ws = conn.ws as MockWebSocket;
      ws.simulateMessage({
        type: 'invoice-paid',
        pr: 'lnbc1test789'
      });

      expect(onPaid).toHaveBeenCalled();
    });
  });

  describe('polling fallback', () => {
    it('should poll for payment status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'PAID' })
      });

      const onPaid = vi.fn();
      const conn = new PaymentConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        domain: 'test.com',
        onPaid
      });

      conn.setInvoice('lnbc1test', 'ref-poll-123');
      conn.start();

      // Initial poll
      await vi.advanceTimersByTimeAsync(0);
      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/lnurlp/pay/status/ref-poll-123?domain=test.com'
      );
      expect(onPaid).toHaveBeenCalled();
    });

    it('should continue polling until paid', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'PENDING' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'PENDING' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'PAID' }) });

      const onPaid = vi.fn();
      const conn = new PaymentConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onPaid
      });

      conn.setInvoice('lnbc1test', 'ref-poll-456');
      conn.start();

      // Initial poll
      await vi.advanceTimersByTimeAsync(0);
      expect(onPaid).not.toHaveBeenCalled();

      // Second poll at 1.5s
      await vi.advanceTimersByTimeAsync(1500);
      expect(onPaid).not.toHaveBeenCalled();

      // Third poll at 3s
      await vi.advanceTimersByTimeAsync(1500);
      await vi.runAllTimersAsync();
      expect(onPaid).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should stop polling and close WebSocket on destroy', async () => {
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null
      });

      conn.setInvoice('lnbc1test', 'ref-123');
      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      conn.destroy();

      expect(conn.getState()).toBe('idle');
    });

    it('should not leak timers after destroy', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'PENDING' })
      });

      const conn = new PaymentConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        domain: null
      });

      conn.setInvoice('lnbc1test', 'ref-123');
      conn.start();
      await vi.advanceTimersByTimeAsync(0);

      const callCount = mockFetch.mock.calls.length;
      conn.destroy();

      // Advance time - no more polls should happen
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch.mock.calls.length).toBe(callCount);
    });
  });

  describe('reconnection', () => {
    it('should attempt to reconnect with exponential backoff', async () => {
      const states: ConnectionState[] = [];
      const conn = new PaymentConnection({
        wsUrl: 'wss://test.example.com',
        apiBaseUrl: 'https://api.example.com',
        domain: null,
        onStateChange: (state) => states.push(state)
      });

      conn.setInvoice('lnbc1test', 'ref-123');
      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      // Simulate close
      // @ts-expect-error - accessing private property for testing
      const ws1 = conn.ws as MockWebSocket;
      ws1.close();

      // First reconnect after 1s (RECONNECT_BASE_MS)
      await vi.advanceTimersByTimeAsync(1000);
      expect(states.filter((s) => s === 'connecting').length).toBeGreaterThanOrEqual(2);
    });
  });
});
