import { mountTipFeed } from '@nostrstack/embed';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNostrstackConfig } from './context';
import { TipActivityFeed } from './tip-activity-feed';

vi.mock('./context');
vi.mock('@nostrstack/embed', () => ({
  mountTipFeed: vi.fn().mockReturnValue({ destroy: vi.fn() })
}));

describe('TipActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNostrstackConfig as any).mockReturnValue({
      lnAddress: 'user@example.com'
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts tip feed on render', () => {
    render(<TipActivityFeed itemId="item1" />);
    expect(mountTipFeed).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        itemId: 'item1',
        host: 'example.com' // Derived from lnAddress
      })
    );
  });
});
