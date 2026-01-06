import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type TipData, TipsFeedConnection } from './tipsFeedConnection.js';

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
}

const mockFetch = vi.fn();

describe('TipsFeedConnection', () => {
  let originalWebSocket: typeof WebSocket;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    originalFetch = global.fetch;
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
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
    it('should create connection with options', () => {
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25
      });

      expect(conn.isConnected()).toBe(false);
    });
  });

  describe('WebSocket connection', () => {
    it('should connect via WebSocket when wsUrl provided', async () => {
      const onConnectionChange = vi.fn();
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onConnectionChange
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      expect(conn.isConnected()).toBe(true);
      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it('should receive tips via WebSocket', async () => {
      const tips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => tips.push(tip)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 100,
        createdAt: '2024-01-01T00:00:00Z',
        providerRef: 'ref-1'
      });

      expect(tips).toHaveLength(1);
      expect(tips[0].amountSats).toBe(100);
    });

    it('should ignore tips for different itemId', async () => {
      const tips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => tips.push(tip)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;
      ws.simulateMessage({
        type: 'tip',
        itemId: 'different-item',
        amount: 100,
        createdAt: '2024-01-01T00:00:00Z'
      });

      expect(tips).toHaveLength(0);
    });

    it('should deduplicate tips by id', async () => {
      const tips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => tips.push(tip)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;

      // Send same tip twice
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 100,
        providerRef: 'ref-duplicate'
      });
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 100,
        providerRef: 'ref-duplicate'
      });

      expect(tips).toHaveLength(1);
    });
  });

  describe('hydration', () => {
    it('should fetch initial tips via HTTP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tips: [
              { amount: 50, createdAt: '2024-01-01T00:00:00Z', providerRef: 'ref-1' },
              { amount: 100, createdAt: '2024-01-01T01:00:00Z', providerRef: 'ref-2' }
            ]
          })
      });

      const conn = new TipsFeedConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25
      });

      const tips = await conn.hydrate();

      expect(tips).toHaveLength(2);
      expect(tips[0].amountSats).toBe(50);
      expect(tips[1].amountSats).toBe(100);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/api/tips/item-123?limit=25');
    });

    it('should return empty array on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const conn = new TipsFeedConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25
      });

      const tips = await conn.hydrate();

      expect(tips).toHaveLength(0);
    });

    it('should mark hydrated tips as seen', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tips: [{ amount: 50, providerRef: 'ref-hydrated' }]
          })
      });

      const receivedTips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => receivedTips.push(tip)
      });

      await conn.hydrate();
      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 50,
        providerRef: 'ref-hydrated'
      });

      // Should not receive duplicate
      expect(receivedTips).toHaveLength(0);
    });
  });

  describe('polling fallback', () => {
    it('should poll when no WebSocket URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tips: [] })
      });

      const conn = new TipsFeedConnection({
        wsUrl: null,
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should stop everything on destroy', async () => {
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);
      expect(conn.isConnected()).toBe(true);

      conn.destroy();
      expect(conn.isConnected()).toBe(false);
    });
  });

  describe('reconnection', () => {
    it('should reconnect after WebSocket close', async () => {
      const onConnectionChange = vi.fn();
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onConnectionChange
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);
      expect(conn.isConnected()).toBe(true);

      // Simulate close
      const ws1 = (conn as unknown as { ws: MockWebSocket }).ws;
      ws1.close();

      expect(conn.isConnected()).toBe(false);
      expect(onConnectionChange).toHaveBeenCalledWith(false);

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(20);

      expect(conn.isConnected()).toBe(true);
    });
  });

  describe('metadata parsing', () => {
    it('should extract note from metadata object', async () => {
      const tips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => tips.push(tip)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 100,
        providerRef: 'ref-note',
        metadata: { note: 'Great article!' }
      });

      expect(tips[0].note).toBe('Great article!');
    });

    it('should parse metadata from JSON string', async () => {
      const tips: TipData[] = [];
      const conn = new TipsFeedConnection({
        wsUrl: 'wss://test.example.com/tips',
        apiBaseUrl: 'https://api.example.com',
        itemId: 'item-123',
        maxItems: 25,
        onTip: (tip) => tips.push(tip)
      });

      conn.start();
      await vi.advanceTimersByTimeAsync(20);

      const ws = (conn as unknown as { ws: MockWebSocket }).ws;
      ws.simulateMessage({
        type: 'tip',
        itemId: 'item-123',
        amount: 100,
        providerRef: 'ref-json-note',
        metadata: JSON.stringify({ note: 'JSON note' })
      });

      expect(tips[0].note).toBe('JSON note');
    });
  });
});
