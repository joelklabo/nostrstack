import { mountShareButton } from '@nostrstack/embed';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNostrstackConfig } from './context';
import { ShareButton } from './share-button';

vi.mock('./context');
vi.mock('@nostrstack/embed', () => ({
  mountShareButton: vi.fn().mockReturnValue({ destroy: vi.fn() })
}));

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNostrstackConfig).mockReturnValue({
      relays: ['wss://relay.example.com']
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts share button on render', () => {
    render(<ShareButton url="https://example.com" title="Example" />);
    expect(mountShareButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        url: 'https://example.com',
        title: 'Example',
        relays: ['wss://relay.example.com']
      })
    );
  });
});
