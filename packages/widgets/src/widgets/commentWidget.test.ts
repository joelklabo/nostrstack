import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectRelays, type RelayConnection } from '../relays.js';
import { renderCommentWidget } from './commentWidget.js';

function createMockRelay(overrides?: Partial<RelayConnection>): RelayConnection {
  return {
    url: 'wss://relay.example.com',
    sub: vi.fn().mockReturnValue({ on: vi.fn(), un: vi.fn() }),
    publish: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as RelayConnection;
}

// Mock dependencies
vi.mock('../relayBadge.js', () => ({
  renderRelayBadge: () => {
    const el = document.createElement('div');
    el.className = 'ns-relay-badge';
    return el;
  },
  updateRelayBadge: vi.fn()
}));

vi.mock('../styles.js', () => ({
  ensureNsRoot: vi.fn()
}));

vi.mock('../relays.js', () => ({
  normalizeRelayUrls: (urls: string[] | undefined) => ({
    valid: urls || ['wss://relay.example.com'],
    invalid: []
  }),
  connectRelays: vi.fn()
}));

describe('renderCommentWidget', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.clearAllMocks();
    vi.mocked(connectRelays).mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as Window & { nostr?: unknown }).nostr;
  });

  it('renders initial state correctly', async () => {
    await renderCommentWidget(host, { headerText: 'Test Comments' });
    expect(host.querySelector('.ns-comments-title')?.textContent).toBe('Test Comments');
    expect(host.querySelector('textarea')).toBeTruthy();
    expect(host.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('connects to relays on mount if lazyConnect is false (default)', async () => {
    const mockRelay = createMockRelay();
    vi.mocked(connectRelays).mockResolvedValue([mockRelay]);

    await renderCommentWidget(host, { relays: ['wss://relay.example.com'] });

    expect(connectRelays).toHaveBeenCalledWith(['wss://relay.example.com']);
  });

  it('does not connect if lazyConnect is true', async () => {
    await renderCommentWidget(host, { lazyConnect: true });
    expect(connectRelays).not.toHaveBeenCalled();
    const btn = host.querySelector('.ns-comments-more');
    expect(btn?.textContent).toBe('Load comments');
  });

  it('connects when load more is clicked', async () => {
    const mockRelay = createMockRelay();
    vi.mocked(connectRelays).mockResolvedValue([mockRelay]);

    await renderCommentWidget(host, { lazyConnect: true, relays: ['wss://relay.example.com'] });

    const btn = host.querySelector('.ns-comments-more') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();

    // allow async ops to clear
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connectRelays).toHaveBeenCalled();
  });

  it('handles post submission', async () => {
    const mockRelay = createMockRelay();
    vi.mocked(connectRelays).mockResolvedValue([mockRelay]);

    // Mock window.nostr
    const signEvent = vi.fn().mockResolvedValue({
      id: 'event-id',
      pubkey: 'pubkey',
      content: 'test comment',
      sig: 'sig'
    });

    Object.assign(window, {
      nostr: {
        getPublicKey: vi.fn().mockResolvedValue('pubkey'),
        signEvent
      }
    });

    await renderCommentWidget(host, { relays: ['wss://relay.example.com'] });

    const textarea = host.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'test comment';

    const form = host.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(signEvent).toHaveBeenCalled();
    expect(mockRelay.publish).toHaveBeenCalled();
  });

  it('destroys correctly', async () => {
    const mockRelay = createMockRelay();
    vi.mocked(connectRelays).mockResolvedValue([mockRelay]);

    const widget = await renderCommentWidget(host, { relays: ['wss://relay.example.com'] });

    // Simulate connection
    await new Promise((resolve) => setTimeout(resolve, 0));

    widget.destroy();

    expect(mockRelay.close).toHaveBeenCalled();
  });
});
