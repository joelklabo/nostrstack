export type ApiBaseResolution = {
  raw: string;
  baseUrl: string;
  isConfigured: boolean;
  isMock: boolean;
  isRelative: boolean;
};

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
  if (trimmed === 'mock') {
    return { raw: trimmed, baseUrl: '', isConfigured: false, isMock: true, isRelative: false };
  }
  if (trimmed === '/api') {
    return { raw: trimmed, baseUrl: '', isConfigured: true, isMock: false, isRelative: true };
  }

  const cleaned = trimmed.replace(/\/$/, '');
  return {
    raw: trimmed,
    baseUrl: preferSecureBase(cleaned),
    isConfigured: true,
    isMock: false,
    isRelative: false
  };
}
