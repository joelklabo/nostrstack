import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderRelayBadge, updateRelayBadge } from './relayBadge.js';

describe('relayBadge', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders initial state correctly with empty relays', () => {
    const badge = renderRelayBadge([], host);
    expect(badge.className).toContain('nostrstack-relay-badge');
    expect(badge.querySelector('.relay-dot')).toBeTruthy();
    expect(badge.querySelector('.relay-label')?.textContent).toBe('offline');
  });

  it('renders initial state correctly with relays', () => {
    const relays = ['wss://relay1.com', 'wss://relay2.com'];
    const badge = renderRelayBadge(relays, host);
    expect(badge.querySelector('.relay-label')?.textContent).toBe(relays.join(', '));
  });

  it('updates badge correctly', () => {
    const badge = renderRelayBadge([], host);
    updateRelayBadge(badge, ['wss://new-relay.com']);
    expect(badge.querySelector('.relay-label')?.textContent).toBe('wss://new-relay.com');
    expect(badge.getAttribute('data-mode')).toBe('real');
    expect(badge.getAttribute('data-relays')).toBe('wss://new-relay.com');
  });

  it('creates new element if target not provided', () => {
    const badge = renderRelayBadge(['wss://relay.com']);
    expect(badge.tagName).toBe('SPAN');
    expect(badge.querySelector('.relay-label')?.textContent).toBe('wss://relay.com');
  });
});
