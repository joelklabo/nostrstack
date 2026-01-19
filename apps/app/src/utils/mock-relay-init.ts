import { useWebSocketImplementation } from 'nostr-tools/pool';

import { installMockRelayWebSocket } from './mock-relay';

const rawRelays = String(import.meta.env.VITE_NOSTRSTACK_RELAYS ?? '')
  .split(/[\s,]+/)
  .map((relay) => relay.trim())
  .filter(Boolean);
const usesMockRelays = rawRelays.some((relay) => {
  const lowered = relay.toLowerCase();
  return lowered === 'mock' || lowered === 'ws://mock' || lowered === 'wss://mock';
});

if (import.meta.env.DEV && usesMockRelays) {
  installMockRelayWebSocket();
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Not a React hook, nostr-tools config function
    useWebSocketImplementation(window.WebSocket);
  }
}
