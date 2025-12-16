import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import App from './App';
import { ToastProvider } from './ui/toast';

describe('App', () => {
  it('renders login screen by default', () => {
    const html = renderToString(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    expect(html).toContain('AUTH_GATEWAY');
  });
});
