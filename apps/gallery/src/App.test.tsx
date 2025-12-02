import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders a heading', () => {
    const html = renderToString(<App />);
    expect(html).toContain('nostrstack Demo');
  });

  it('shows test signer toggle copy', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Built-in Nostr test signer');
  });
});
