import { isIP } from 'node:net';

type HostPattern = {
  host: string;
  wildcard: boolean;
  matchAll: boolean;
};

export type HostAllowlist = {
  raw: string[];
  patterns: HostPattern[];
  invalid: string[];
};

type TelemetryUrlGuardOptions = {
  label: string;
  requireHttps: boolean;
  allowPrivateHosts: boolean;
  allowlist: HostAllowlist;
};

const LOCALHOST_HOSTS = new Set(['localhost', 'localhost.', '127.0.0.1', '0.0.0.0', '::1', '::']);

const normalizeHostname = (hostname: string) => {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
};

const parseHostPattern = (raw: string): HostPattern | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === '*') return { host: '*', wildcard: false, matchAll: true };
  let host = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      return null;
    }
  } else {
    host = trimmed.split('/')[0];
    host = host.split('@').pop() ?? host;
    if (host.startsWith('[') && host.includes(']')) {
      host = host.slice(1, host.indexOf(']'));
    } else if (host.includes(':')) {
      host = host.split(':')[0];
    }
  }
  const wildcard = host.startsWith('*.');
  const normalized = wildcard ? host.slice(2).toLowerCase() : host.toLowerCase();
  if (!normalized) return null;
  return { host: normalized, wildcard, matchAll: false };
};

const matchesHostPattern = (hostname: string, pattern: HostPattern) => {
  if (pattern.matchAll) return true;
  const host = hostname.toLowerCase();
  if (pattern.wildcard) {
    return host === pattern.host || host.endsWith(`.${pattern.host}`);
  }
  return host === pattern.host;
};

export const parseHostAllowlist = (raw?: string): HostAllowlist => {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const patterns: HostPattern[] = [];
  const invalid: string[] = [];
  for (const entry of entries) {
    const parsed = parseHostPattern(entry);
    if (!parsed) {
      invalid.push(entry);
    } else {
      patterns.push(parsed);
    }
  }
  return { raw: entries, patterns, invalid };
};

const isAllowlisted = (hostname: string, allowlist: HostAllowlist) =>
  allowlist.patterns.some((pattern) => matchesHostPattern(hostname, pattern));

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
};

const isPrivateIpv6 = (ip: string) => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.replace('::ffff:', '');
    return isPrivateIpv4(mapped);
  }
  return false;
};

const isPrivateHost = (hostname: string) => {
  const normalized = normalizeHostname(hostname).toLowerCase();
  if (LOCALHOST_HOSTS.has(normalized)) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
};

export const validateTelemetryUrl = (rawUrl: string | undefined, options: TelemetryUrlGuardOptions) => {
  if (!rawUrl) return null;
  if (options.allowlist.invalid.length) {
    return `TELEMETRY_HOST_ALLOWLIST has invalid entries: ${options.allowlist.invalid.join(', ')}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return `${options.label} must be a valid http(s) URL.`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `${options.label} must use http or https.`;
  }
  if (options.requireHttps && parsed.protocol !== 'https:') {
    return `${options.label} must use https in production.`;
  }
  const hostname = normalizeHostname(parsed.hostname);
  const hasAllowlist = options.allowlist.raw.length > 0;
  const allowlisted = isAllowlisted(hostname, options.allowlist);
  if (hasAllowlist && !allowlisted) {
    return `${options.label} host ${hostname} is not in TELEMETRY_HOST_ALLOWLIST.`;
  }
  if (!options.allowPrivateHosts && isPrivateHost(hostname) && !allowlisted) {
    return `${options.label} must not use localhost or private IPs in production.`;
  }
  return null;
};
