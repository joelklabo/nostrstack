import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Relay } from 'nostr-tools/relay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNostrstackConfig } from './context';
import { ShareWidget } from './share-widget';

vi.mock('./context');
vi.mock('@nostrstack/embed', () => ({
  ensureNostrstackRoot: vi.fn()
}));
vi.mock('nostr-tools/relay', () => ({
  Relay: {
    connect: vi.fn()
  }
}));

describe('ShareWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNostrstackConfig as any).mockReturnValue({
      relays: ['wss://relay.example.com']
    });

    // Mock Relay connection
    (Relay.connect as any).mockResolvedValue({
      subscribe: vi.fn().mockReturnValue({
        close: vi.fn()
      }),
      close: vi.fn(),
      _connected: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly', () => {
    render(<ShareWidget itemId="item1" url="https://example.com" title="Example" />);
    expect(screen.getByText('Shares')).toBeTruthy();
  });

  it('connects to relays on mount', async () => {
    render(<ShareWidget itemId="item1" url="https://example.com" title="Example" />);
    await waitFor(() => {
      expect(Relay.connect).toHaveBeenCalledWith('wss://relay.example.com');
    });
  });
});
