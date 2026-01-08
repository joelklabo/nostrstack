import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AuthContextType, useAuth } from './auth';
import { useNostrstackConfig } from './context';
import { ReactionButton } from './reaction-button';

vi.mock('./auth');
vi.mock('./context');
vi.mock('nostr-tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nostr-tools')>();
  return {
    ...actual,
    SimplePool: vi.fn().mockImplementation(() => ({
      publish: vi.fn().mockReturnValue([Promise.resolve()]),
      close: vi.fn()
    }))
  };
});

const mockEvent = {
  id: 'event1',
  pubkey: 'pubkey1',
  kind: 1,
  content: 'hello',
  created_at: 1000,
  tags: [],
  sig: 'sig'
};

describe('ReactionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      pubkey: 'mypubkey',
      signEvent: vi.fn().mockResolvedValue({ id: 'reaction', sig: 'sig' })
    } as unknown as AuthContextType);
    vi.mocked(useNostrstackConfig).mockReturnValue({
      relays: ['wss://relay.example.com']
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly', () => {
    render(<ReactionButton event={mockEvent} />);
    expect(screen.getByRole('button', { name: 'Like this note' })).toBeTruthy();
  });

  it('reacts on click', async () => {
    render(<ReactionButton event={mockEvent} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByLabelText('Liked')).toBeTruthy();
    });
  });

  it('shows alert if not logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({ pubkey: null } as unknown as AuthContextType);
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ReactionButton event={mockEvent} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(alertMock).toHaveBeenCalledWith('You must be logged in to react.');
  });
});
