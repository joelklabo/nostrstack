/**
 * PaymentConnection - Manages WebSocket connection for payment status updates
 *
 * This class encapsulates:
 * - WebSocket connection lifecycle
 * - Reconnection with exponential backoff
 * - Payment status polling fallback
 * - Invoice/providerRef matching
 */

import { MAX_RECONNECT_DELAY_MS, PAID_STATES, RECONNECT_BASE_MS } from '../config.js';
import { extractPayEventInvoice, extractPayEventProviderRef } from '../helpers.js';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'error';

export interface PaymentConnectionOptions {
  wsUrl: string | null;
  apiBaseUrl: string;
  domain: string | null;
  onStateChange?: (state: ConnectionState) => void;
  onPaid?: () => void;
}

/**
 * Normalize invoice string for comparison
 */
function normalizeInvoice(pr: string | null): string | null {
  if (!pr) return null;
  return pr.toLowerCase().replace(/^lightning:/i, '');
}

export class PaymentConnection {
  private wsUrl: string | null;
  private apiBaseUrl: string;
  private domain: string | null;
  private onStateChange?: (state: ConnectionState) => void;
  private onPaid?: () => void;

  private ws: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private pollId: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  private currentInvoice: string | null = null;
  private currentProviderRef: string | null = null;
  private isPaid = false;

  constructor(opts: PaymentConnectionOptions) {
    this.wsUrl = opts.wsUrl;
    this.apiBaseUrl = opts.apiBaseUrl;
    this.domain = opts.domain;
    this.onStateChange = opts.onStateChange;
    this.onPaid = opts.onPaid;
  }

  /**
   * Set the current invoice and provider ref to watch for
   */
  setInvoice(invoice: string, providerRef: string | null): void {
    this.currentInvoice = normalizeInvoice(invoice);
    this.currentProviderRef = providerRef;
    this.isPaid = false;
  }

  /**
   * Clear the current invoice tracking
   */
  clearInvoice(): void {
    this.currentInvoice = null;
    this.currentProviderRef = null;
  }

  /**
   * Start watching for payment (WebSocket + polling)
   */
  start(): void {
    this.startWebSocket();
    this.startPolling();
  }

  /**
   * Stop all connections and polling
   */
  stop(): void {
    this.closeWebSocket();
    this.stopPolling();
    this.clearReconnect();
    this.setState('idle');
  }

  /**
   * Destroy the connection (alias for stop)
   */
  destroy(): void {
    this.stop();
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if payment was detected
   */
  hasPaid(): boolean {
    return this.isPaid;
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange?.(state);
    }
  }

  private markPaid(): void {
    if (this.isPaid) return;
    this.isPaid = true;
    this.stopPolling();
    this.onPaid?.();
  }

  private startWebSocket(): void {
    if (!this.wsUrl) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.closeWebSocket();

    try {
      this.setState('connecting');
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('open');
      };

      ws.onerror = () => {
        this.setState('error');
      };

      ws.onclose = () => {
        this.setState(this.state === 'error' ? 'error' : 'idle');
        this.scheduleReconnect();
      };

      ws.onmessage = (ev) => {
        this.handleMessage(ev);
      };
    } catch {
      this.setState('error');
    }
  }

  private handleMessage(ev: MessageEvent): void {
    try {
      const msg = JSON.parse(ev.data as string) as unknown;
      if (!msg || typeof msg !== 'object') return;

      const rec = msg as Record<string, unknown>;
      const kind = rec.type;
      const statusStr = typeof rec.status === 'string' ? rec.status.toUpperCase() : '';
      const paid =
        kind === 'invoice-paid' || (kind === 'invoice-status' && PAID_STATES.has(statusStr));

      if (!paid) return;

      const msgProviderRef = extractPayEventProviderRef(msg);
      const msgInvoice = normalizeInvoice(extractPayEventInvoice(msg));

      if (
        (msgInvoice && this.currentInvoice && msgInvoice === this.currentInvoice) ||
        (msgProviderRef && this.currentProviderRef && msgProviderRef === this.currentProviderRef)
      ) {
        this.markPaid();
      }
    } catch {
      /* ignore parse errors */
    }
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
  }

  private scheduleReconnect(): void {
    if (this.isPaid) return;
    this.clearReconnect();

    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts)
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.startWebSocket();
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
    if (!this.currentProviderRef || typeof window === 'undefined') return;

    // Initial poll
    void this.pollOnce();

    // Poll every 1.5 seconds
    this.pollId = setInterval(() => {
      void this.pollOnce();
    }, 1500);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  private async pollOnce(): Promise<boolean> {
    if (!this.currentProviderRef || this.isPaid) return false;

    try {
      const domainParam = this.domain ? `?domain=${encodeURIComponent(this.domain)}` : '';
      const res = await fetch(
        `${this.apiBaseUrl}/api/lnurlp/pay/status/${encodeURIComponent(this.currentProviderRef)}${domainParam}`
      );

      if (!res.ok) return false;

      const body = (await res.json()) as { status?: unknown };
      const statusStr = String(body.status ?? '').toUpperCase();

      if (PAID_STATES.has(statusStr)) {
        this.markPaid();
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
