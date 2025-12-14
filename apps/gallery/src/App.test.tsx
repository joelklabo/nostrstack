import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import App from './App';
import { ToastProvider } from './toast';

describe('App', () => {
  it('renders a heading', () => {
    const html = renderToString(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    expect(html).toContain('nostrstack Demo');
  });

  it('shows relays input copy', () => {
    const html = renderToString(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    expect(html).toContain('Relays (comments)');
  });
});
