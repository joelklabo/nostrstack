import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountPayToAction, mountTipButton } from './index.js';

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
    vi.spyOn(globalThis, 'fetch' as unknown as typeof fetch).mockResolvedValueOnce({
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
    await button.onclick?.(new Event('click'));

    expect(write).toHaveBeenCalledWith(pr);
  });
});

describe('mountPayToAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('copies invoice and unlocks when verify succeeds', async () => {
    const host = document.createElement('div');
    const pr = 'lnbc1payinvoice';
    vi.spyOn(globalThis, 'fetch' as unknown as typeof fetch).mockResolvedValueOnce({
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

    await button.onclick?.(new Event('click'));

    // Simulate user confirming payment
    const confirm = host.querySelector('button:last-of-type') as HTMLButtonElement;
    await confirm.onclick?.(new Event('click'));

    expect(write).toHaveBeenCalledWith(pr);
    expect(onUnlock).toHaveBeenCalled();
  });
});
