import { ToastProvider } from '@nostrstack/ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

vi.mock('./screens/EventDetailScreen', () => ({
  EventDetailScreen: () => {
    throw new Error('Critical module load failed');
  }
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('App', () => {
  it('renders login screen by default', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }) as unknown as Response
    );
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to NostrStack' })).toBeTruthy();
    });
  });

  it('renders a recovery UI when event detail module fails to load', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }) as unknown as Response
    );
    window.history.pushState({}, '', '/nostr/abc123');
    window.dispatchEvent(new PopStateEvent('popstate'));

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load event screen. Please try reloading.')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Retry route' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to feed' })).toBeTruthy();
  });

  it('renders when fetch fails for health check (suppresses console noise)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to NostrStack' })).toBeTruthy();
    });

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
