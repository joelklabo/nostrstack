import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mountBlockchainStats,
  mountNostrProfile,
  mountPayToAction,
  mountShareButton,
  mountTipButton,
  mountTipFeed,
  mountTipWidget,
  renderCommentWidget
} from './index.js';

describe('mountTipButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a button element', () => {
    const host = document.createElement('div');
    const button = mountTipButton(host, { text: 'Test' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('copies invoice on click', async () => {
    const host = document.createElement('div');
    const pr = 'lnbc1testinvoice';
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pr })
      } as Response);
    const write = vi.fn();
    (
      globalThis.navigator as unknown as {
        clipboard: { writeText: (s: string) => Promise<void> | void };
      }
    ).clipboard = {
      writeText: write
    };

    const button = mountTipButton(host, { username: 'alice', amountSats: 5 });
    await button.onclick?.(new MouseEvent('click'));

    expect(write).toHaveBeenCalledWith(pr);
  });
});

describe('mountPayToAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('copies invoice and unlocks when verify succeeds', async () => {
    const host = document.createElement('div');
    const pr = 'lnbc1payinvoice';
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pr })
      } as Response);

    const write = vi.fn();
    (
      globalThis.navigator as unknown as {
        clipboard: { writeText: (s: string) => Promise<void> | void };
      }
    ).clipboard = {
      writeText: write
    };

    const onUnlock = vi.fn();
    const button = mountPayToAction(host, {
      username: 'alice',
      amountSats: 10,
      verifyPayment: async () => true,
      onUnlock
    });

    await button.onclick?.(new MouseEvent('click'));

    // Simulate user confirming payment
    const confirm = host.querySelector('.ns-pay-confirm') as HTMLButtonElement;
    await confirm.onclick?.(new MouseEvent('click'));

    expect(write).toHaveBeenCalledWith(pr);
    expect(onUnlock).toHaveBeenCalled();
  });

  it('unlocks via status polling when provider_ref is returned', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    const pr = 'lnbc1payinvoice';
    const providerRef = 'ref123';
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.includes('/.well-known/lnurlp/alice')) {
          return {
            ok: true,
            json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
          } as Response;
        }
        if (url.includes('/api/lnurlp/alice/invoice')) {
          return {
            ok: true,
            json: async () => ({ pr, provider_ref: providerRef })
          } as Response;
        }
        if (url.includes(`/api/lnurlp/pay/status/${providerRef}`)) {
          return {
            ok: true,
            json: async () => ({ status: 'PAID' })
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }
    );

    const write = vi.fn();
    (
      globalThis.navigator as unknown as {
        clipboard: { writeText: (s: string) => Promise<void> | void };
      }
    ).clipboard = {
      writeText: write
    };

    const onUnlock = vi.fn();
    const button = mountPayToAction(host, {
      username: 'alice',
      amountSats: 10,
      onUnlock
    });

    await button.onclick?.(new MouseEvent('click'));
    await vi.advanceTimersByTimeAsync(1500);

    expect(write).toHaveBeenCalledWith(pr);
    expect(onUnlock).toHaveBeenCalled();
  });
});

describe('mountTipWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a mock invoice from a preset', async () => {
    const host = document.createElement('div');
    const write = vi.fn();
    (
      globalThis.navigator as unknown as {
        clipboard: { writeText: (s: string) => Promise<void> | void };
      }
    ).clipboard = {
      writeText: write
    };

    mountTipWidget(host, {
      username: 'alice',
      itemId: 'post-123',
      baseURL: 'mock',
      host: 'mock',
      presetAmountsSats: [5, 10, 21],
      showFeed: false
    });

    const preset = host.querySelector('.ns-tip__amt') as HTMLButtonElement;
    expect(preset).toBeTruthy();
    await preset.onclick?.(new MouseEvent('click'));

    const code = host.querySelector('.ns-invoice-box code')?.textContent?.trim() ?? '';
    expect(code).toMatch(/^ln/i);
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/^ln/i));
  });

  it('treats baseURL=/api as same-origin (no /api/api URLs)', async () => {
    const host = document.createElement('div');
    const write = vi.fn();
    (
      globalThis.navigator as unknown as {
        clipboard: { writeText: (s: string) => Promise<void> | void };
      }
    ).clipboard = {
      writeText: write
    };

    const pr = 'lnbc1testinvoice';
    const providerRef = 'ref123';
    const fetchSpy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/pay')) {
          return {
            ok: true,
            json: async () => ({ pr, provider_ref: providerRef })
          } as Response;
        }
        // allow poll attempts to fail quietly
        throw new Error(`Unexpected fetch: ${url}`);
      });

    mountTipWidget(host, {
      username: 'alice',
      itemId: 'post-123',
      baseURL: '/api',
      host: 'localhost',
      presetAmountsSats: [5],
      showFeed: false
    });

    const preset = host.querySelector('.ns-tip__amt') as HTMLButtonElement;
    await preset.onclick?.(new MouseEvent('click'));

    expect(fetchSpy).toHaveBeenCalled();
    const firstUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(firstUrl).toContain('/api/pay');
    expect(firstUrl).not.toContain('/api/api/');
  });
});

describe('mountShareButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as unknown as { nostr?: unknown }).nostr;
    delete (globalThis as unknown as { NostrTools?: unknown }).NostrTools;
    delete (globalThis.navigator as unknown as { share?: unknown }).share;
  });

  it('publishes to relays when signer is available', async () => {
    const host = document.createElement('div');
    const publish = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    (globalThis as unknown as { NostrTools: { relayInit: (url: string) => unknown } }).NostrTools =
      {
        relayInit: () => ({ connect, publish, close })
      };
    (
      globalThis as unknown as {
        nostr: {
          getPublicKey: () => Promise<string>;
          signEvent: (ev: unknown) => Promise<unknown>;
        };
      }
    ).nostr = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey'),
      signEvent: vi.fn(async (ev) => ({ ...(ev as object), id: 'id', sig: 'sig' }))
    };

    mountShareButton(host, {
      url: 'https://example.com/post',
      title: 'Post',
      relays: ['wss://relay.example']
    });
    const button = host.querySelector('button') as HTMLButtonElement;
    await button.onclick?.(new MouseEvent('click'));

    expect(connect).toHaveBeenCalled();
    expect(publish).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('falls back to navigator.share when signer is unavailable', async () => {
    const host = document.createElement('div');
    const share = vi.fn().mockResolvedValue(undefined);
    (globalThis.navigator as unknown as { share: (data: unknown) => Promise<void> | void }).share =
      share;

    mountShareButton(host, { url: 'https://example.com/post', title: 'Post' });
    const button = host.querySelector('button') as HTMLButtonElement;
    await button.onclick?.(new MouseEvent('click'));

    expect(share).toHaveBeenCalled();
  });
});

describe('mountTipFeed realtime', () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it('prepends tip events from ws and de-duplicates by paymentId', async () => {
    const host = document.createElement('div');
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, totalAmountSats: 0, tips: [] })
    } as Response);

    const instances: Array<{
      url: string;
      onopen?: () => void;
      onmessage?: (ev: { data: string }) => void;
      onclose?: () => void;
      onerror?: () => void;
      close?: () => void;
    }> = [];

    class MockWebSocket {
      url: string;
      onopen?: () => void;
      onmessage?: (ev: { data: string }) => void;
      onclose?: () => void;
      onerror?: () => void;
      constructor(url: string) {
        this.url = url;
        instances.push(this);
        // Call onopen synchronously for test
        queueMicrotask(() => {
          this.onopen?.();
        });
      }
      close() {
        this.onclose?.();
      }
    }

    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    mountTipFeed(host, { itemId: 'post-123', baseURL: '/api', host: 'localhost', maxItems: 5 });

    // Wait for hydration promise and WebSocket connection
    await vi.waitFor(() => {
      expect(instances.length).toBeGreaterThan(0);
    });

    const ws = instances[0]!;
    const payload = {
      type: 'tip',
      itemId: 'post-123',
      amount: 21,
      createdAt: new Date().toISOString(),
      providerRef: 'ref-1',
      paymentId: 'pay-1',
      metadata: { note: 'Great' }
    };
    ws.onmessage?.({ data: JSON.stringify(payload) });
    ws.onmessage?.({ data: JSON.stringify(payload) });

    const rows = host.querySelectorAll('.ns-tip-feed__row');
    expect(rows.length).toBe(1);
    expect(host.textContent).toContain('21 sats');
  });
});

describe('renderCommentWidget', () => {
  const OriginalNostrTools = (globalThis as unknown as { NostrTools?: unknown }).NostrTools;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as unknown as { NostrTools?: unknown }).NostrTools = OriginalNostrTools;
  });

  it('caps initial load and loads more comments', async () => {
    const host = document.createElement('div');

    class MockSub {
      private eventHandlers: Array<(ev: unknown) => void> = [];
      private eoseHandlers: Array<() => void> = [];
      on(type: string, cb: (ev: unknown) => void) {
        if (type === 'event') this.eventHandlers.push(cb);
        if (type === 'eose') this.eoseHandlers.push(cb as () => void);
      }
      emitEvent(ev: unknown) {
        this.eventHandlers.forEach((cb) => cb(ev));
      }
      emitEose() {
        this.eoseHandlers.forEach((cb) => cb());
      }
      un() {
        // no-op
      }
    }

    const subs: MockSub[] = [];
    const relay = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      sub: vi.fn(() => {
        const sub = new MockSub();
        subs.push(sub);
        return sub;
      }),
      publish: vi.fn()
    };

    (globalThis as unknown as { NostrTools?: { relayInit: (url: string) => unknown } }).NostrTools =
      {
        relayInit: () => relay
      };

    await renderCommentWidget(host, {
      threadId: 'thread-1',
      relays: ['wss://relay.example'],
      maxItems: 2
    });

    const sub = subs[0]!;
    sub.emitEvent({
      id: 'id-1',
      content: 'First',
      created_at: 100,
      kind: 1,
      tags: [['t', 'thread-1']],
      pubkey: 'pk',
      sig: 'sig'
    });
    sub.emitEvent({
      id: 'id-2',
      content: 'Second',
      created_at: 101,
      kind: 1,
      tags: [['t', 'thread-1']],
      pubkey: 'pk',
      sig: 'sig'
    });
    sub.emitEose();

    expect(host.querySelectorAll('.ns-comment').length).toBe(2);

    const loadMoreBtn = host.querySelector('.ns-comments-more') as HTMLButtonElement;
    expect(loadMoreBtn.hidden).toBe(false);

    loadMoreBtn.click();
    const sub2 = subs[1]!;
    sub2.emitEvent({
      id: 'id-3',
      content: 'Third',
      created_at: 90,
      kind: 1,
      tags: [['t', 'thread-1']],
      pubkey: 'pk',
      sig: 'sig'
    });
    sub2.emitEose();

    expect(host.querySelectorAll('.ns-comment').length).toBe(3);
  });

  it('skips unsigned events when validation is enabled', async () => {
    const host = document.createElement('div');

    class MockSub {
      private eventHandlers: Array<(ev: unknown) => void> = [];
      private eoseHandlers: Array<() => void> = [];
      on(type: string, cb: (ev: unknown) => void) {
        if (type === 'event') this.eventHandlers.push(cb);
        if (type === 'eose') this.eoseHandlers.push(cb as () => void);
      }
      emitEvent(ev: unknown) {
        this.eventHandlers.forEach((cb) => cb(ev));
      }
      emitEose() {
        this.eoseHandlers.forEach((cb) => cb());
      }
      un() {
        // no-op
      }
    }

    const subs: MockSub[] = [];
    const relay = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      sub: vi.fn(() => {
        const sub = new MockSub();
        subs.push(sub);
        return sub;
      }),
      publish: vi.fn()
    };

    (globalThis as unknown as { NostrTools?: { relayInit: (url: string) => unknown } }).NostrTools =
      {
        relayInit: () => relay
      };

    await renderCommentWidget(host, {
      threadId: 'thread-1',
      relays: ['wss://relay.example'],
      maxItems: 1,
      validateEvents: true
    });

    const sub = subs[0]!;
    sub.emitEvent({
      id: 'id-1',
      content: 'Unsigned',
      created_at: 100,
      kind: 1,
      tags: [['t', 'thread-1']],
      pubkey: 'pk'
    });
    sub.emitEose();

    expect(host.querySelectorAll('.ns-comment').length).toBe(0);
  });
});

describe('mountBlockchainStats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('hydrates from telemetry summary', async () => {
    const host = document.createElement('div');
    const summary = {
      type: 'block',
      height: 820000,
      mempoolTxs: 1200,
      mempoolBytes: 5_000_000,
      network: 'mainnet',
      time: 1_700_000_000
    };

    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => summary
    } as Response);

    const widget = mountBlockchainStats(host, { baseURL: 'http://localhost:3001' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const height = host.querySelector('[data-stat="height"]')?.textContent ?? '';
    const mempool = host.querySelector('[data-stat="mempoolTxs"]')?.textContent ?? '';
    const network = host.querySelector('[data-stat="network"]')?.textContent ?? '';

    expect(height).toContain('820');
    expect(mempool).toContain('1,200');
    expect(network).toBe('mainnet');

    widget.destroy();
  });
});

describe('mountNostrProfile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders a profile card from nip05', async () => {
    const host = document.createElement('div');
    const pubkey = 'a'.repeat(64);
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.includes('/api/nostr/identity')) {
          return {
            ok: true,
            json: async () => ({
              pubkey,
              nip05: 'alice@example.com',
              name: 'alice',
              domain: 'example.com',
              relays: ['wss://relay.test']
            })
          } as Response;
        }
        if (url.includes('/api/nostr/event/')) {
          return {
            ok: true,
            json: async () => ({
              author: { pubkey, profile: { name: 'Alice', nip05: 'alice@example.com' } }
            })
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }
    );

    const widget = mountNostrProfile(host, {
      identifier: 'alice@example.com',
      baseURL: 'http://localhost:3001'
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const card = host.querySelector('.ns-user-card');
    expect(card).toBeTruthy();

    widget.destroy();
  });
});
