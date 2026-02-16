import { ToastProvider } from '@nostrstack/ui';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders login screen by default', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    // It should transition to login
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to NostrStack' })).toBeTruthy();
    });
  });
});
