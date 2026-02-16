export type ApiBaseResolution = {
  raw: string;
  baseUrl: string;
  isConfigured: boolean;
  isMock: boolean;
  isRelative: boolean;
};

const LOCAL_API_PORT = 3001;

function normalizeLegacyLocalApiBase(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'localhost' && parsed.port === '3002') {
      parsed.port = String(LOCAL_API_PORT);
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return raw;
  }
  return raw;
}

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
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
  if (trimmed === '/api') {
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
