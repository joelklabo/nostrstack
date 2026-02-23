import { Relay } from 'nostr-tools';
import { useWebSocketImplementation } from 'nostr-tools/pool';
import { validateEvent, verifyEvent } from 'nostr-tools/pure';

import { installMockRelayWebSocket } from './mock-relay';

function setupNostrTools() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { NostrTools?: unknown };
  if (w.NostrTools) return;

  w.NostrTools = {
    relayInit: (url: string) => new Relay(url),
    validateEvent: validateEvent as (event: unknown) => boolean,
    verifySignature: verifyEvent as (event: unknown) => boolean
  };
}

setupNostrTools();

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
