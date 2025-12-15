export type RelayBadgeState = 'connecting' | 'real' | 'offline';

import { ensureNostrstackEmbedStyles, nostrstackEmbedStyles } from './styles.js';

export function renderRelayBadge(relays: string[], target?: HTMLElement) {
  const el = target ?? document.createElement('span');
  el.className = 'nostrstack-relay-badge';
  ensureNostrstackEmbedStyles(el.ownerDocument);
  if (!el.closest?.('.nostrstack-theme')) el.classList.add('nostrstack-theme');
  el.classList.add('nostrstack');
  const dot = document.createElement('span');
  dot.className = 'relay-dot';
  const label = document.createElement('span');
  label.className = 'relay-label';
  label.textContent = relays.length ? relays.join(', ') : 'offline';
  el.innerHTML = '';
  el.appendChild(dot);
  el.appendChild(label);
  updateRelayBadge(el, relays);
  return el;
}

export function updateRelayBadge(el: HTMLElement, relays: string[]) {
  el.setAttribute('data-mode', 'real');
  el.setAttribute('data-relays', relays.join(','));
  const label = el.querySelector('.relay-label');
  if (label) label.textContent = relays.length ? relays.join(', ') : 'offline';
}

// For SSR / manual inclusion (includes tokens + base primitives + badge styles).
export const relayBadgeStyles = nostrstackEmbedStyles;
