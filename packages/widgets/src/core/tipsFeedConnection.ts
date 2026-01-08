/**
 * TipsFeedConnection - Manages WebSocket connection for receiving tip feed updates
 *
 * This class encapsulates:
 * - WebSocket connection for real-time tip notifications
 * - Reconnection with exponential backoff
 * - HTTP polling fallback
 * - Tip data parsing and validation
 */

import { MAX_RECONNECT_DELAY_MS, RECONNECT_BASE_MS } from '../config.js';
import { parseMaybeJson } from '../helpers.js';

export interface TipData {
  id?: string;
  paymentId?: string;
  amountSats: number;
  createdAt: Date;
  note?: string;
}

export interface TipsFeedConnectionOptions {
  wsUrl: string | null;
  apiBaseUrl: string;
  itemId: string;
  maxItems: number;
  onTip?: (tip: TipData) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class TipsFeedConnection {
  private wsUrl: string | null;
  private apiBaseUrl: string;
  private itemId: string;
  private maxItems: number;
  private onTip?: (tip: TipData) => void;
  private onConnectionChange?: (connected: boolean) => void;

  private ws: WebSocket | null = null;
  private wsConnected = false;
  private pollId: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private seenIds = new Set<string>();

  constructor(opts: TipsFeedConnectionOptions) {
    this.wsUrl = opts.wsUrl;
    this.apiBaseUrl = opts.apiBaseUrl;
    this.itemId = opts.itemId;
    this.maxItems = opts.maxItems;
    this.onTip = opts.onTip;
    this.onConnectionChange = opts.onConnectionChange;
  }

  /**
   * Start the connection (WebSocket preferred, polling fallback)
   */
  start(): void {
    if (this.wsUrl) {
      this.connectWebSocket();
    } else {
      this.startPolling();
    }
  }

  /**
   * Stop all connections and cleanup
   */
  stop(): void {
    this.destroyed = true;
    this.closeWebSocket();
    this.stopPolling();
    this.clearReconnect();
  }

  /**
   * Destroy the connection (alias for stop)
   */
  destroy(): void {
    this.stop();
  }

  /**
   * Check if WebSocket is currently connected
   */
  isConnected(): boolean {
    return this.wsConnected;
  }

  /**
   * Fetch initial tips data via HTTP
   */
  async hydrate(): Promise<TipData[]> {
    try {
      const res = await fetch(
        `${this.apiBaseUrl}/api/tips/${encodeURIComponent(this.itemId)}?limit=${this.maxItems}`
      );
      if (!res.ok) return [];

      const data = (await res.json()) as { tips?: unknown[] };
      if (!Array.isArray(data.tips)) return [];

      const tips: TipData[] = [];
      for (const t of data.tips) {
        const tip = this.parseTipFromApi(t);
        if (tip) {
          this.seenIds.add(
            tip.id ?? tip.paymentId ?? `${tip.amountSats}-${tip.createdAt.getTime()}`
          );
          tips.push(tip);
        }
      }

      return tips;
    } catch {
      return [];
    }
  }

  private parseTipFromApi(t: unknown): TipData | null {
    if (!t || typeof t !== 'object') return null;
    const rec = t as Record<string, unknown>;

    const amountSats = typeof rec.amount === 'number' ? rec.amount : null;
    if (amountSats == null) return null;

    const createdAt = typeof rec.createdAt === 'string' ? new Date(rec.createdAt) : new Date();
    const paymentId = typeof rec.paymentId === 'string' ? rec.paymentId : undefined;
    const providerRef = typeof rec.providerRef === 'string' ? rec.providerRef : undefined;

    const meta =
      rec.metadata && typeof rec.metadata === 'object'
        ? rec.metadata
        : typeof rec.metadata === 'string'
          ? parseMaybeJson(rec.metadata)
          : undefined;

    const note =
      meta && typeof meta === 'object' && typeof (meta as Record<string, unknown>).note === 'string'
        ? ((meta as Record<string, unknown>).note as string)
        : undefined;

    return {
      id: providerRef,
      paymentId,
      amountSats,
      createdAt,
      note
    };
  }

  private connectWebSocket(): void {
    if (!this.wsUrl || typeof window === 'undefined' || this.destroyed) return;

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch {
      this.handleWsClosed();
      return;
    }

    this.ws.onopen = () => {
      this.wsConnected = true;
      this.reconnectAttempts = 0;
      this.stopPolling();
      this.onConnectionChange?.(true);
    };

    this.ws.onmessage = (ev) => {
      this.handleMessage(ev);
    };

    this.ws.onerror = () => this.handleWsClosed();
    this.ws.onclose = () => this.handleWsClosed();
  }

  private handleMessage(ev: MessageEvent): void {
    try {
      const msg = JSON.parse(ev.data as string) as unknown;
      if (!msg || typeof msg !== 'object') return;

      const rec = msg as Record<string, unknown>;

      if (rec.type === 'error') {
        this.onConnectionChange?.(this.wsConnected);
        return;
      }

      if (rec.type !== 'tip') return;

      const wsItemId = typeof rec.itemId === 'string' ? rec.itemId : null;
      if (!wsItemId || wsItemId !== this.itemId) return;

      const tip = this.parseTipFromApi(rec);
      if (!tip) return;

      const tipId = tip.id ?? tip.paymentId ?? `${tip.amountSats}-${tip.createdAt.getTime()}`;
      if (this.seenIds.has(tipId)) return;

      this.seenIds.add(tipId);
      this.onTip?.(tip);
    } catch {
      /* ignore parse errors */
    }
  }

  private handleWsClosed(): void {
    this.wsConnected = false;
    this.onConnectionChange?.(false);
    this.startPolling();
    this.scheduleReconnect();
  }

  private closeWebSocket(): void {
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.wsConnected = false;
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.clearReconnect();

    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts)
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startPolling(): void {
    this.stopPolling();
    if (typeof window === 'undefined' || this.destroyed) return;

    this.pollId = setInterval(() => {
      void this.pollOnce();
    }, 5000);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.destroyed) return;

    try {
      const res = await fetch(
        `${this.apiBaseUrl}/api/tips/${encodeURIComponent(this.itemId)}?limit=${this.maxItems}`
      );
      if (!res.ok) return;

      const data = (await res.json()) as { tips?: unknown[] };
      if (!Array.isArray(data.tips)) return;

      for (const t of data.tips) {
        const tip = this.parseTipFromApi(t);
        if (!tip) continue;

        const tipId = tip.id ?? tip.paymentId ?? `${tip.amountSats}-${tip.createdAt.getTime()}`;
        if (this.seenIds.has(tipId)) continue;

        this.seenIds.add(tipId);
        this.onTip?.(tip);
      }
    } catch {
      /* ignore */
    }
  }
}
