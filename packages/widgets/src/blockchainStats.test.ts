import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderBlockchainStats } from './blockchainStats.js';

describe('renderBlockchainStats', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    renderBlockchainStats(host);
    expect(host.querySelector('.ns-blockchain-stats__title')?.textContent).toBe('Blockchain');
    expect(host.querySelector('.ns-status')?.textContent).toBe('Loading…');
  });

  it('renders mock data correctly', () => {
    renderBlockchainStats(host, { baseURL: 'http://localhost:3000' }); // Assuming localhost triggers mock check if defined as such, but logic is `isMockBase`.
    // Wait, isMockBase might need 'localhost' or '127.0.0.1'. Let's verify `url-utils.js`.
    // But better to check what `isMockBase` expects.
    // For now let's assume `mock` triggers it based on test in tipWidget.

    renderBlockchainStats(host, { baseURL: 'mock' });
    expect(host.querySelector('.ns-status')?.textContent).toBe('Mock data');
    expect(host.querySelector('[data-stat="height"]')?.textContent).not.toBe('—');
  });

  it('fetches data on hydration', async () => {
    const summary = {
      height: 100,
      mempoolTxs: 10,
      mempoolBytes: 1000,
      network: 'testnet'
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summary
    } as Response);

    const widget = renderBlockchainStats(host);
    // Hydrate is called in renderBlockchainStats, but async.
    // We can manually call refresh returned by widget to await it, or just wait.
    await widget.refresh();

    expect(global.fetch).toHaveBeenCalled();
    expect(host.querySelector('[data-stat="height"]')?.textContent).toBe('100');
    expect(host.querySelector('[data-stat="network"]')?.textContent).toBe('testnet');
  });

  it('handles fetch error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    } as Response);

    const widget = renderBlockchainStats(host);

    await widget.refresh();

    expect(host.querySelector('.ns-status--danger')?.textContent).toBe('Telemetry unavailable');

    const retryBtn = host.querySelector('.ns-btn') as HTMLButtonElement;

    expect(retryBtn.hidden).toBe(false); // Retry button visible
  });
});
