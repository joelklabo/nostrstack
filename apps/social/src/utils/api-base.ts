import type { ApiBaseResolution } from '@nostrstack/react';
import { resolveApiBase } from '@nostrstack/react';

export type { ApiBaseResolution };
export { resolveApiBase };

export type GalleryApiBaseInput = {
  apiBase?: string;
  baseUrl?: string;
  apiBaseConfig?: ApiBaseResolution;
};

const DEFAULT_LOCAL_HOST = 'localhost';
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', '::1'];

function normalizeLegacyLocalApiBase(raw: string): string {
  const trimmed = normalizeInput(raw);
  if (!trimmed) return raw;
  if (!/^https?:\/\/localhost:/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

function normalizeInput(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function resolveRuntimeApiOrigin(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const origin = window.location.origin;
  return normalizeInput(origin) || '';
}

function resolveRuntimeHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const host = window.location.hostname;
  return normalizeInput(host) || '';
}

function isLocalRuntime(): boolean {
  return import.meta.env.DEV || import.meta.env.NODE_ENV === 'test';
}

function resolveFallbackApiBase(): string {
  if (isLocalRuntime()) {
    return '/api';
  }
  return resolveRuntimeApiOrigin();
}

function pickFirstDefined(...values: Array<string | undefined>): string {
  return (
    values.map(normalizeInput).find((candidate): candidate is string => Boolean(candidate)) || ''
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function convertToWsScheme(url: string): string {
  return url.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
}

function preferSecureWsUrl(url: string): string {
  const converted = convertToWsScheme(url);
  if (typeof window === 'undefined') return converted;
  if (window.location.protocol !== 'https:') return converted;
  return converted.replace(/^ws:\/\//i, 'wss://');
}

function isLocalhostUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOCAL_HOSTNAMES.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function resolveRuntimeApiBase(baseURL?: string): string {
  const explicit = normalizeInput(baseURL);
  if (explicit) {
    const normalized = normalizeLegacyLocalApiBase(explicit);
    if (isLocalhostUrl(normalized) && normalized.startsWith('http://')) {
      let url = trimTrailingSlash(normalized);
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        url = url.replace(/^http:/i, 'https:');
      }
      return url;
    }
    return trimTrailingSlash(preferSecureBase(normalized));
  }
  const fallback = resolveFallbackApiBase();
  if (isLocalhostUrl(fallback) && fallback.startsWith('http://')) {
    let url = trimTrailingSlash(fallback);
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      url = url.replace(/^http:/i, 'https:');
    }
    return url;
  }
  return trimTrailingSlash(preferSecureBase(fallback));
}

export function resolveRuntimeHost(host?: string): string {
  const explicit = normalizeInput(host);
  if (explicit) {
    return explicit;
  }
  if (isLocalRuntime()) {
    return DEFAULT_LOCAL_HOST;
  }
  return resolveRuntimeHostname();
}

export function resolveRuntimeWsUrl(baseURL: string | undefined, path: string): string | null {
  if (typeof window === 'undefined') return null;

  const raw = resolveRuntimeApiBase(baseURL);
  const runtimeApiBase = resolveApiBase(baseURL);
  if (!raw) return null;
  const normalizedPath = ensureLeadingSlash(path);
  const websocketOrigin = convertToWsScheme(window.location.origin);

  if (!runtimeApiBase.isConfigured) {
    return `${websocketOrigin}${normalizedPath}`;
  }

  if (runtimeApiBase.isRelative && runtimeApiBase.raw === '/api') {
    return `${websocketOrigin}${normalizedPath}`;
  }

  if (!raw || /^ws(s)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    return `${preferSecureWsUrl(raw)}${normalizedPath}`;
  }

  if (raw.startsWith('/')) {
    return `${websocketOrigin}${raw}${normalizedPath}`;
  }

  return `${websocketOrigin}/${raw}${normalizedPath}`;
}

function preferSecureBase(value: string): string {
  if (typeof window === 'undefined') return value;
  if (window.location.protocol !== 'https:') {
    return value;
  }
  if (!/^http:\/\//i.test(value)) {
    return value;
  }
  return value.replace(/^http:/i, 'https:');
}

export function resolveGalleryApiBase(config: GalleryApiBaseInput = {}): ApiBaseResolution {
  if (config.apiBaseConfig) {
    return config.apiBaseConfig;
  }
  const raw = pickFirstDefined(
    config.apiBase,
    config.baseUrl,
    import.meta.env.VITE_API_BASE_URL,
    resolveFallbackApiBase()
  );
  const normalized = raw ? normalizeLegacyLocalApiBase(raw) : raw;
  return resolveApiBase(normalized);
}
