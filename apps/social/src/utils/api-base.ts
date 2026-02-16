import type { ApiBaseResolution } from '@nostrstack/react';
import { resolveApiBase } from '@nostrstack/react';

export type { ApiBaseResolution };
export { resolveApiBase };

export type GalleryApiBaseInput = {
  apiBase?: string;
  baseUrl?: string;
  apiBaseConfig?: ApiBaseResolution;
};

const DEFAULT_LOCAL_API_BASE = 'http://localhost:3001';
const DEFAULT_LOCAL_HOST = 'localhost';

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
    return DEFAULT_LOCAL_API_BASE;
  }
  const origin = resolveRuntimeApiOrigin();
  return origin || DEFAULT_LOCAL_API_BASE;
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

export function resolveRuntimeApiBase(baseURL?: string): string {
  const explicit = normalizeInput(baseURL);
  if (explicit) {
    return trimTrailingSlash(preferSecureBase(explicit));
  }
  return trimTrailingSlash(preferSecureBase(resolveFallbackApiBase()));
}

export function resolveRuntimeHost(host?: string): string {
  const explicit = normalizeInput(host);
  if (explicit) {
    return explicit;
  }
  if (isLocalRuntime()) {
    return DEFAULT_LOCAL_HOST;
  }
  return resolveRuntimeHostname() || DEFAULT_LOCAL_HOST;
}

export function resolveRuntimeWsUrl(baseURL: string | undefined, path: string): string | null {
  if (typeof window === 'undefined') return null;

  const raw = resolveRuntimeApiBase(baseURL);
  if (!raw) return null;
  const normalizedPath = ensureLeadingSlash(path);
  const websocketOrigin = convertToWsScheme(window.location.origin);

  if (!raw || /^ws(s)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    return `${convertToWsScheme(raw)}${normalizedPath}`;
  }

  if (raw === '/api') {
    return `${websocketOrigin}${raw}${normalizedPath}`;
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
  return resolveApiBase(raw);
}
