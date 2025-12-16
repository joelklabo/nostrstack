import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import App from './App';
import { ToastProvider } from './ui/toast';

describe('App', () => {
  it('renders login screen by default', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    // It should transition to login
    await waitFor(() => {
      expect(screen.getByText('AUTH_GATEWAY')).toBeTruthy();
    });
  });
});
