import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderPayToAction } from './payToAction.js';

describe('renderPayToAction', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders initial button state', () => {
    const { el } = renderPayToAction(host, { username: 'alice', text: 'Unlock Me' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.textContent).toBe('Unlock Me');
    expect(host.querySelector('.nostrstack-pay-panel')).toBeTruthy();
    expect((host.querySelector('.nostrstack-pay-panel') as HTMLElement).style.display).toBe('none');
  });

  it('generates invoice and shows panel on click', async () => {
    const pr = 'lnbc1testinvoice';
    const providerRef = 'ref123';

    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ callback: 'http://localhost:3001/api/lnurlp/alice/invoice' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pr, provider_ref: providerRef })
      } as Response);

    const write = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: write
      }
    });

    const { el: btn } = renderPayToAction(host, { username: 'alice' });

    // Click button
    await btn.onclick?.(new MouseEvent('click'));

    // Should display panel
    expect((host.querySelector('.nostrstack-pay-panel') as HTMLElement).style.display).toBe(
      'block'
    );
    // Should show invoice code
    expect(host.querySelector('.nostrstack-code')?.textContent).toBe(pr);
    // Should try to copy to clipboard
    expect(write).toHaveBeenCalledWith(pr);
  });

  it('unlocks when verifyPayment succeeds', async () => {
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

    const onUnlock = vi.fn();
    const verifyPayment = vi.fn().mockResolvedValue(true);

    const { el: btn } = renderPayToAction(host, {
      username: 'alice',
      verifyPayment,
      onUnlock
    });

    await btn.onclick?.(new MouseEvent('click'));

    // Manually click "I've paid" since verifyPayment is mocked to be manual or we wait for it
    const confirm = host.querySelector('.nostrstack-pay-confirm') as HTMLButtonElement;
    await confirm.onclick?.(new MouseEvent('click'));

    expect(verifyPayment).toHaveBeenCalledWith(pr);
    expect(onUnlock).toHaveBeenCalled();
    expect(host.classList.contains('nostrstack-pay--unlocked')).toBe(true);
  });

  it('unlocks when PaymentConnection detects payment', async () => {
    vi.useFakeTimers();
    const pr = 'lnbc1testinvoice';
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

    const onUnlock = vi.fn();
    const { el: btn } = renderPayToAction(host, {
      username: 'alice',
      onUnlock
    });

    await btn.onclick?.(new MouseEvent('click'));

    // Fast forward for polling
    await vi.advanceTimersByTimeAsync(1500);

    expect(onUnlock).toHaveBeenCalled();
  });

  it('destroys correctly', async () => {
    const { destroy, el: btn } = renderPayToAction(host, { username: 'alice' });
    const removeListenerSpy = vi.spyOn(btn, 'removeEventListener');

    destroy();

    expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
