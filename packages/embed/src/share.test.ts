import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderShareButton } from './share.js';

vi.mock('./copyButton.js', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined)
}));
import { copyToClipboard } from './copyButton.js';

describe('renderShareButton', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as Window & { nostr?: unknown }).nostr;
  });

  it('renders correctly', () => {
    renderShareButton(host, { url: 'https://example.com', title: 'Example' });
    expect(host.querySelector('button')).toBeTruthy();
    expect(host.querySelector('button')?.textContent).toBe('Share to Nostr');
  });

  it('uses clipboard fallback when share is clicked and navigator.share is undefined', async () => {
    renderShareButton(host, { url: 'https://example.com', title: 'Example' });
    const btn = host.querySelector('button');
    btn?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('Example\nhttps://example.com')
    );
    expect(host.querySelector('.nostrstack-status--success')?.textContent).toBe(
      'Copied to clipboard'
    );
  });

  it('uses navigator.share if available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    renderShareButton(host, { url: 'https://example.com', title: 'Example' });
    const btn = host.querySelector('button');
    btn?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Example',
      text: expect.stringContaining('Example\nhttps://example.com'),
      url: 'https://example.com'
    });
    expect(host.querySelector('.nostrstack-status--success')?.textContent).toBe('Shared');
  });

  it('attempts NIP-07 share if nostr is present', async () => {
    const signEvent = vi.fn().mockResolvedValue({
      id: 'event-id',
      pubkey: 'pubkey',
      content: 'content',
      sig: 'sig'
    });
    const mockRelay = {
      connect: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      close: vi.fn()
    };
    const relayInit = vi.fn().mockReturnValue(mockRelay);

    Object.assign(window, {
      nostr: {
        getPublicKey: vi.fn().mockResolvedValue('pubkey'),
        signEvent
      },
      NostrTools: {
        relayInit
      }
    });

    renderShareButton(host, {
      url: 'https://example.com',
      title: 'Example',
      relays: ['wss://relay.example.com']
    });

    const btn = host.querySelector('button');
    btn?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(relayInit).toHaveBeenCalledWith('wss://relay.example.com');
    expect(mockRelay.connect).toHaveBeenCalled();
    expect(signEvent).toHaveBeenCalled();
    expect(mockRelay.publish).toHaveBeenCalled();
    expect(mockRelay.close).toHaveBeenCalled();
    expect(host.querySelector('.nostrstack-status--success')?.textContent).toBe('Shared to Nostr');
  });

  it('resets to idle state after sharing', async () => {
    vi.useFakeTimers();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    renderShareButton(host, { url: 'https://example.com', title: 'Example' });
    const btn = host.querySelector('button');
    btn?.click();

    // Allow async share to complete (flush microtasks)
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(host.querySelector('.nostrstack-status--success')?.textContent).toBe('Shared');

    vi.advanceTimersByTime(2000);

    expect(host.querySelector('.nostrstack-status')?.textContent).toBe('');
    expect(host.querySelector('button')?.textContent).toBe('Share to Nostr');

    vi.useRealTimers();
  });
});
