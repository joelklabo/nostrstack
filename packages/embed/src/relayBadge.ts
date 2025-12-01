export type RelayBadgeState = 'connecting' | 'real' | 'mock' | 'offline';

export function renderRelayBadge(relays: string[], mode: 'real' | 'mock', target?: HTMLElement) {
  const el = target ?? document.createElement('span');
  el.className = 'nostrstack-relay-badge';
  const dot = document.createElement('span');
  dot.className = 'relay-dot';
  const label = document.createElement('span');
  label.className = 'relay-label';
  label.textContent = relays.length ? relays.join(', ') : mode === 'mock' ? 'mock' : 'offline';
  el.innerHTML = '';
  el.appendChild(dot);
  el.appendChild(label);
  updateRelayBadge(el, relays, mode);
  return el;
}

export function updateRelayBadge(el: HTMLElement, relays: string[], mode: 'real' | 'mock') {
  el.setAttribute('data-mode', mode);
  el.setAttribute('data-relays', relays.join(','));
  const label = el.querySelector('.relay-label');
  if (label) label.textContent = relays.length ? relays.join(', ') : mode === 'mock' ? 'mock' : 'offline';
}

export const relayBadgeStyles = `
.nostrstack-relay-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 12px;
  border: 1px solid #e2e8f0;
}
.nostrstack-relay-badge .relay-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #facc15;
  box-shadow: 0 0 0 0 rgba(250,204,21,0.6);
  animation: pulse 2s infinite;
}
.nostrstack-relay-badge[data-mode="mock"] .relay-dot {
  background: #94a3b8;
  animation: none;
}
.nostrstack-relay-badge[data-mode="real"] .relay-dot {
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
  70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
`;
