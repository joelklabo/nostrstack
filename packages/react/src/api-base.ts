export type ApiBaseResolution = {
  raw: string;
  baseUrl: string;
  isConfigured: boolean;
  isMock: boolean;
  isRelative: boolean;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function normalizeLegacyLocalApiBase(raw: string): string {
  return raw;
}

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
  try {
    const parsed = new URL(base);
    if (parsed.hostname && LOCAL_HOSTNAMES.has(parsed.hostname)) {
      return base;
    }
  } catch {
    return base;
  }
  return base.replace(/^http:/i, 'https:');
}

export function resolveApiBase(raw?: string | null): ApiBaseResolution {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { raw: '', baseUrl: '', isConfigured: false, isMock: false, isRelative: false };
  }
  const normalized = normalizeLegacyLocalApiBase(trimmed);
  if (trimmed === 'mock') {
    return { raw: trimmed, baseUrl: '', isConfigured: false, isMock: true, isRelative: false };
  }
  if (/^\/api\/?$/.test(normalized)) {
    return { raw: trimmed, baseUrl: '', isConfigured: true, isMock: false, isRelative: true };
  }

  const cleaned = normalized.replace(/\/$/, '');
  return {
    raw: normalized,
    baseUrl: preferSecureBase(cleaned),
    isConfigured: true,
    isMock: false,
    isRelative: false
  };
}
