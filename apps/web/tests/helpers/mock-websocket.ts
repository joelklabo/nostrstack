/**
 * Shared MockWebSocket implementation for Playwright e2e tests.
 * Used to mock Nostr relay connections in browser context.
 */

import type { Page } from '@playwright/test';
import type { Event } from 'nostr-tools';

/**
 * MockWebSocket init script that can be passed to page.addInitScript.
 * This creates a MockWebSocket class in the browser context that mimics
 * the WebSocket API and responds to Nostr relay protocol messages.
 *
 * @param events - Array of Nostr events to serve from the mock relay
 * @param options - Additional configuration options
 */
export function getMockWebSocketScript(
  events: Event[],
  options: {
    zapAddress?: string;
    handleEvent?: boolean;
  } = {}
) {
  const { zapAddress, handleEvent = false } = options;

  return {
    script: ({
      events,
      zapAddress,
      handleEvent
    }: {
      events: Event[];
      zapAddress?: string;
      handleEvent?: boolean;
    }) => {
      type MockEvent = { data?: string; type?: string };
      type ListenerType = 'open' | 'message' | 'error' | 'close';
      type HandlerKey = `on${ListenerType}`;

      class MockWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        url: string;
        readyState = MockWebSocket.CONNECTING;
        onopen: ((ev: MockEvent) => void) | null = null;
        onmessage: ((ev: MockEvent) => void) | null = null;
        onerror: ((ev: MockEvent) => void) | null = null;
        onclose: ((ev: MockEvent) => void) | null = null;
        private listeners: Record<ListenerType, Set<(ev: MockEvent) => void>> = {
          open: new Set(),
          message: new Set(),
          error: new Set(),
          close: new Set()
        };

        constructor(url: string) {
          this.url = url;
          queueMicrotask(() => {
            this.readyState = MockWebSocket.OPEN;
            this.dispatch('open', { type: 'open' });
          });
        }

        private dispatch(type: ListenerType, event: MockEvent) {
          const handlerKey = `on${type}` as HandlerKey;
          const handler = this[handlerKey];
          if (typeof handler === 'function') handler(event);
          for (const listener of this.listeners[type] ?? []) {
            listener(event);
          }
        }

        send(data: string) {
          try {
            const parsed = JSON.parse(data) as unknown[];
            const msgType = parsed[0];

            if (msgType === 'REQ') {
              const subId = parsed[1] as string;
              const filters = parsed.slice(2) as Array<{
                kinds?: number[];
                authors?: string[];
                '#e'?: string[];
                '#p'?: string[];
              }>;
              const sent = new Set<string>();

              for (const filter of filters) {
                for (const event of events) {
                  const kindOk = !filter.kinds || filter.kinds.includes(event.kind);
                  const authorOk = !filter.authors || filter.authors.includes(event.pubkey);

                  // Check e and p tag filters
                  const eTagValues = event.tags.filter((t) => t[0] === 'e').map((t) => t[1]);
                  const eFilterOk =
                    !filter['#e'] || filter['#e'].some((e) => eTagValues.includes(e));

                  const pTagValues = event.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
                  const pFilterOk =
                    !filter['#p'] || filter['#p'].some((p) => pTagValues.includes(p));

                  if (kindOk && authorOk && eFilterOk && pFilterOk && !sent.has(event.id)) {
                    sent.add(event.id);
                    this.dispatch('message', { data: JSON.stringify(['EVENT', subId, event]) });
                  }
                }
                this.dispatch('message', { data: JSON.stringify(['EOSE', subId]) });
              }
            }

            if (msgType === 'EVENT' && handleEvent) {
              // Echo back OK for published events
              const evt = parsed[1] as Event;
              this.dispatch('message', { data: JSON.stringify(['OK', evt.id, true, '']) });
            }

            if (msgType === 'CLOSE') {
              // Subscription closed, no response needed
            }
          } catch {
            // Ignore invalid payloads
          }
        }

        close() {
          this.readyState = MockWebSocket.CLOSED;
          this.dispatch('close', { type: 'close' });
        }

        addEventListener(type: string, handler: (ev: MockEvent) => void) {
          const key = type as ListenerType;
          if (this.listeners[key]) {
            this.listeners[key].add(handler);
          }
        }

        removeEventListener(type: string, handler: (ev: MockEvent) => void) {
          const key = type as ListenerType;
          if (this.listeners[key]) {
            this.listeners[key].delete(handler);
          }
        }
      }

      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
        MockWebSocket as unknown as typeof WebSocket;

      if (zapAddress) {
        (window as Window & { __NOSTRSTACK_ZAP_ADDRESS__?: string }).__NOSTRSTACK_ZAP_ADDRESS__ =
          zapAddress;
      }
    },
    args: { events, zapAddress, handleEvent }
  };
}

/**
 * Install a mock Nostr relay in the page context.
 *
 * @param page - Playwright Page object
 * @param events - Array of Nostr events to serve
 * @param options - Additional configuration
 * @returns Promise that resolves when the mock is installed
 */
export async function installMockRelay(
  page: Page,
  events: Event[],
  options: {
    zapAddress?: string;
    handleEvent?: boolean;
  } = {}
): Promise<void> {
  const { script, args } = getMockWebSocketScript(events, options);
  await page.addInitScript(script, args);
}

/**
 * Type declaration for window globals set by the mock
 */
declare global {
  interface Window {
    __NOSTRSTACK_ZAP_ADDRESS__?: string;
    __NOSTRSTACK_MOCK_EVENTS__?: Event[];
  }
}
