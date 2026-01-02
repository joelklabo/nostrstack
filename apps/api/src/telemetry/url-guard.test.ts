import { describe, expect, it } from 'vitest';

import { parseHostAllowlist, validateTelemetryUrl } from './url-guard.js';

const baseOptions = {
  label: 'TELEMETRY_ESPLORA_URL',
  requireHttps: true,
  allowPrivateHosts: false,
  allowlist: parseHostAllowlist()
};

describe('parseHostAllowlist', () => {
  it('captures invalid patterns', () => {
    const allowlist = parseHostAllowlist('://bad,*.example.com');
    expect(allowlist.invalid).toContain('://bad');
    expect(allowlist.patterns.length).toBe(1);
  });
});

describe('validateTelemetryUrl', () => {
  it('accepts https URLs in production', () => {
    expect(validateTelemetryUrl('https://mempool.space', baseOptions)).toBeNull();
  });

  it('rejects http URLs in production', () => {
    const error = validateTelemetryUrl('http://mempool.space', baseOptions);
    expect(error).toContain('https');
  });

  it('rejects localhost in production', () => {
    const error = validateTelemetryUrl('https://localhost:3001', baseOptions);
    expect(error).toContain('localhost');
  });

  it('allows allowlisted private hosts in production', () => {
    const allowlist = parseHostAllowlist('localhost,10.0.0.1');
    const error = validateTelemetryUrl('https://localhost:3001', {
      ...baseOptions,
      allowlist
    });
    expect(error).toBeNull();
  });

  it('allows http localhost in dev', () => {
    const error = validateTelemetryUrl('http://127.0.0.1:18443', {
      label: 'BITCOIND_RPC_URL',
      requireHttps: false,
      allowPrivateHosts: true,
      allowlist: parseHostAllowlist()
    });
    expect(error).toBeNull();
  });

  it('enforces allowlist when provided', () => {
    const allowlist = parseHostAllowlist('*.example.com');
    const ok = validateTelemetryUrl('https://api.example.com', {
      ...baseOptions,
      allowlist
    });
    const bad = validateTelemetryUrl('https://evil.com', {
      ...baseOptions,
      allowlist
    });
    expect(ok).toBeNull();
    expect(bad).toContain('TELEMETRY_HOST_ALLOWLIST');
  });

  it('rejects IPv6 localhost in production', () => {
    const error = validateTelemetryUrl('https://[::1]', baseOptions);
    expect(error).toContain('localhost');
  });

  it('rejects when allowlist entries are invalid', () => {
    const allowlist = parseHostAllowlist('://bad');
    const error = validateTelemetryUrl('https://mempool.space', {
      ...baseOptions,
      allowlist
    });
    expect(error).toContain('invalid entries');
  });
});
