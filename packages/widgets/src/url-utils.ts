const isMockBase = (baseURL?: string) => baseURL === 'mock';

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
  return base.replace(/^http:/i, 'https:');
}

function getBrowserOriginFallback() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function resolveApiBaseUrl(baseURL?: string) {
  if (isMockBase(baseURL)) return '';

  const raw = baseURL?.trim() ?? '';
  if (!raw) {
    return getBrowserOriginFallback();
  }

  const normalized = raw.replace(/\/$/, '');
  if (!normalized) {
    return getBrowserOriginFallback();
  }

  if (normalized !== '/api') return normalized;
  return getBrowserOriginFallback();
}

function resolvePayWsUrl(baseURL?: string): string | null {
  if (isMockBase(baseURL)) return null;
  if (typeof window === 'undefined') return null;

  const base = preferSecureBase(resolveApiBaseUrl(baseURL));
  const wsOrigin = window.location.origin.replace(/^http/i, 'ws');

  if (!base) {
    return `${wsOrigin}/ws/pay`;
  }
  if (base === '/api') {
    return `${wsOrigin}/ws/pay`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/pay`;
  }

  return `${wsOrigin}${base}/ws/pay`;
}

function resolveTelemetryWs(baseURL?: string): string | null {
  if (isMockBase(baseURL)) return null;
  if (typeof window === 'undefined') return null;

  const base = preferSecureBase(resolveApiBaseUrl(baseURL));
  const wsOrigin = window.location.origin.replace(/^http/i, 'ws');

  if (!base) {
    return `${wsOrigin}/ws/telemetry`;
  }
  if (base === '/api') {
    return `${wsOrigin}/ws/telemetry`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/telemetry`;
  }

  return `${wsOrigin}${base}/ws/telemetry`;
}

export { isMockBase, preferSecureBase, resolveApiBaseUrl, resolvePayWsUrl, resolveTelemetryWs };
