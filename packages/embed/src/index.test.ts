import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountBlockchainStats, mountNostrProfile, mountPayToAction, mountTipButton, mountTipWidget } from './index.js';

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
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
    } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pr })
    } as Response);
    const write = vi.fn();
    (globalThis.navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> | void } }).clipboard = {
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
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
    } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pr })
    } as Response);

    const write = vi.fn();
    (globalThis.navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> | void } }).clipboard = {
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
    const confirm = host.querySelector('.nostrstack-pay-confirm') as HTMLButtonElement;
    await confirm.onclick?.(new MouseEvent('click'));

    expect(write).toHaveBeenCalledWith(pr);
    expect(onUnlock).toHaveBeenCalled();
  });

  it('unlocks via status polling when provider_ref is returned', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    const pr = 'lnbc1payinvoice';
    const providerRef = 'ref123';
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockImplementation(async (input) => {
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
    });

    const write = vi.fn();
    (globalThis.navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> | void } }).clipboard = {
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
    (globalThis.navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> | void } }).clipboard =
      {
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

    const preset = host.querySelector('.nostrstack-tip__amt') as HTMLButtonElement;
    expect(preset).toBeTruthy();
    await preset.onclick?.(new MouseEvent('click'));

    const code = host.querySelector('.nostrstack-invoice-box code')?.textContent?.trim() ?? '';
    expect(code).toMatch(/^ln/i);
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/^ln/i));
  });

  it('treats baseURL=/api as same-origin (no /api/api URLs)', async () => {
    const host = document.createElement('div');
    const write = vi.fn();
    (globalThis.navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> | void } }).clipboard =
      {
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

    const preset = host.querySelector('.nostrstack-tip__amt') as HTMLButtonElement;
    await preset.onclick?.(new MouseEvent('click'));

    expect(fetchSpy).toHaveBeenCalled();
    const firstUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(firstUrl).toContain('/api/pay');
    expect(firstUrl).not.toContain('/api/api/');
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
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockImplementation(async (input) => {
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
    });

    const widget = mountNostrProfile(host, { identifier: 'alice@example.com', baseURL: 'http://localhost:3001' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const card = host.querySelector('.nostrstack-user-card');
    expect(card).toBeTruthy();

    widget.destroy();
  });
});
