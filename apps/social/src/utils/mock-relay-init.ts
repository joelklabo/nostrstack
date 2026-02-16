import { useWebSocketImplementation } from 'nostr-tools/pool';

import { installMockRelayWebSocket } from './mock-relay';

type MockRelayWindow = {
  __NOSTRSTACK_MOCK_EVENTS__?: unknown;
};

function hasMockEventsSeed(): boolean {
  if (typeof window === 'undefined') return false;
  const seeded = (window as MockRelayWindow).__NOSTRSTACK_MOCK_EVENTS__;
  return Array.isArray(seeded) && seeded.length > 0;
}

const rawRelays = String(import.meta.env.VITE_NOSTRSTACK_RELAYS ?? '')
  .split(/[\s,]+/)
  .map((relay) => relay.trim())
  .filter(Boolean);
const usesMockRelays =
  rawRelays.some((relay) => {
    const lowered = relay.toLowerCase();
    return lowered === 'mock' || lowered === 'ws://mock' || lowered === 'wss://mock';
  }) || hasMockEventsSeed();

if (import.meta.env.DEV && usesMockRelays) {
  installMockRelayWebSocket();
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Not a React hook, nostr-tools config function
    useWebSocketImplementation(window.WebSocket);
  }
}
