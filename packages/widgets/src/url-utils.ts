const isMockBase = (baseURL?: string) => baseURL === 'mock';

function preferSecureBase(base: string) {
  if (typeof window === 'undefined') return base;
  if (window.location.protocol !== 'https:') return base;
  if (!/^http:\/\//i.test(base)) return base;
  return base.replace(/^http:/i, 'https:');
}

function resolveApiBaseUrl(baseURL?: string) {
  if (isMockBase(baseURL)) return '';
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = raw.replace(/\/$/, '');
  if (base && base !== '/api') return base;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return window.location.origin;
}

function resolvePayWsUrl(baseURL?: string): string | null {
  if (isMockBase(baseURL)) return null;
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = preferSecureBase(raw.replace(/\/$/, ''));
  if (base === '/api') {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/pay`;
  }
  if (!base) {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/pay`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/pay`;
  }
  return `${window.location.origin.replace(/^http/i, 'ws')}${base}/ws/pay`;
}

function resolveTelemetryWs(baseURL?: string): string | null {
  if (isMockBase(baseURL)) return null;
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = preferSecureBase(raw.replace(/\/$/, ''));
  if (base === '/api') {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  if (!base) {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/telemetry`;
  }
  return `${window.location.origin.replace(/^http/i, 'ws')}${base}/ws/telemetry`;
}

export { isMockBase, preferSecureBase, resolveApiBaseUrl, resolvePayWsUrl, resolveTelemetryWs };
