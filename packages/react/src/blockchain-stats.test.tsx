import { mountBlockchainStats } from '@nostrstack/widgets';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockchainStats } from './blockchain-stats';
import { useNostrstackConfig } from './context';

vi.mock('./context');
vi.mock('@nostrstack/widgets', () => ({
  mountBlockchainStats: vi.fn().mockReturnValue({ destroy: vi.fn() })
}));

describe('BlockchainStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNostrstackConfig).mockReturnValue({
      baseUrl: 'https://api.example.com'
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts blockchain stats on render', () => {
    render(<BlockchainStats title="Stats" />);
    expect(mountBlockchainStats).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        title: 'Stats',
        baseURL: 'https://api.example.com'
      })
    );
  });
});
