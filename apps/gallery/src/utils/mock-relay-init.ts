import { installMockRelayWebSocket } from './mock-relay';

const rawRelays = String(import.meta.env.VITE_NOSTRSTACK_RELAYS ?? '')
  .split(/[\s,]+/)
  .map((relay) => relay.trim())
  .filter(Boolean);
const usesMockRelays = rawRelays.some((relay) => relay.toLowerCase() === 'mock');

if (import.meta.env.DEV && usesMockRelays) {
  installMockRelayWebSocket();
}
