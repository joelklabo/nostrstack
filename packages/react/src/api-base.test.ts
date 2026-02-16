import { afterEach, describe, expect, it } from 'vitest';

import { resolveApiBase } from './api-base';

describe('resolveApiBase', () => {
  const restoreLocation = () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => original
    });
  };

  const withProtocol = (protocol: string) => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({ ...original, protocol })
    });
    return () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        get: () => original
      });
    };
  };

  afterEach(() => {
    restoreLocation();
  });

  it('normalizes legacy localhost:3002 API base and upgrades to https on secure pages', () => {
    const restore = withProtocol('https:');
    const result = resolveApiBase('http://localhost:3002');
    restore();
    expect(result.baseUrl).toBe('https://localhost:3001');
    expect(result.raw).toBe('http://localhost:3001');
  });

  it('normalizes legacy localhost:3002 HTTPS API base URLs', () => {
    const restore = withProtocol('https:');
    const result = resolveApiBase('https://localhost:3002');
    restore();
    expect(result.baseUrl).toBe('https://localhost:3001');
    expect(result.raw).toBe('https://localhost:3001');
  });

  it('normalizes legacy localhost:3002 on non-secure pages', () => {
    const restore = withProtocol('http:');
    const result = resolveApiBase('http://localhost:3002');
    restore();
    expect(result.baseUrl).toBe('http://localhost:3001');
    expect(result.raw).toBe('http://localhost:3001');
    expect(window.location.protocol).toBe('http:');
  });

  it('preserves relative API paths', () => {
    const restore = withProtocol('https:');
    const result = resolveApiBase('/api');
    restore();
    expect(result.baseUrl).toBe('');
    expect(result.isRelative).toBe(true);
    expect(result.raw).toBe('/api');
  });
});
