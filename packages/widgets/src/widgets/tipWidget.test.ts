import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTipWidget } from './tipWidget.js';

describe('renderTipWidget', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders initial state correctly', () => {
    renderTipWidget(host, { username: 'alice', itemId: 'item123' });

    expect(host.querySelector('.ns-tip__title')).toBeTruthy();
    expect(host.textContent).toContain('Pay @alice');
    expect(host.querySelectorAll('.ns-tip__amt').length).toBe(3);
  });

  it('generates invoice on preset click', async () => {
    const pr = 'lnbc1testinvoice';
    const providerRef = 'ref123';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pr, provider_ref: providerRef })
    } as Response);

    vi.stubGlobal('fetch', fetchMock);

    const write = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: write
      }
    });

    renderTipWidget(host, { username: 'alice', itemId: 'item123', host: 'example.com' });

    const presetBtn = host.querySelector('.ns-tip__amt') as HTMLButtonElement;
    await presetBtn.onclick?.(new MouseEvent('click'));

    // Should show invoice code (truncated)
    const code = host.querySelector('.ns-code')?.textContent;
    expect(code).toContain(pr.substring(0, 8));
    // Should try to copy to clipboard
    expect(write).toHaveBeenCalledWith(pr);
  });

  it('uses mock mode correctly', async () => {
    const write = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: write
      }
    });

    renderTipWidget(host, {
      username: 'alice',
      itemId: 'item123',
      baseURL: 'mock',
      presetAmountsSats: [50],
      showFeed: false
    });

    const presetBtn = host.querySelector('.ns-tip__amt') as HTMLButtonElement;
    await presetBtn.onclick?.(new MouseEvent('click'));

    const code = host.querySelector('.ns-code')?.textContent;
    expect(code).toContain('lnbc1moc'); // Check first part
    expect(write).toHaveBeenCalledWith('lnbc1mock50');
  });

  it('destroys correctly', async () => {
    const widget = renderTipWidget(host, { username: 'alice', itemId: 'item123' });
    // Should not throw
    widget.destroy();
  });
});
