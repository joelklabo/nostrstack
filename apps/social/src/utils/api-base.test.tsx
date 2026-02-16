import { describe, expect, it } from 'vitest';

import { resolveRuntimeWsUrl } from './api-base';

describe('resolveRuntimeWsUrl', () => {
  const getWebSocketOrigin = () =>
    window.location.origin.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

  it('uses secure websocket scheme for absolute HTTPS base URLs', () => {
    const url = resolveRuntimeWsUrl('https://api.local', '/ws/telemetry');
    expect(url).toBe('wss://api.local/ws/telemetry');
  });

  it('maps "/api" runtime base to host root websocket path', () => {
    const url = resolveRuntimeWsUrl('/api', '/ws/telemetry');
    expect(url).toBe(`${getWebSocketOrigin()}/ws/telemetry`);
  });

  it('keeps non-api relative base URL path when provided', () => {
    const url = resolveRuntimeWsUrl('/api-proxy', '/ws/telemetry');
    expect(url).toBe(`${getWebSocketOrigin()}/api-proxy/ws/telemetry`);
  });
});
