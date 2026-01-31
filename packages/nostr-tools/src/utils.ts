import { bytesToHex, hexToBytes } from './internal.js';

export { bytesToHex, hexToBytes };

export function normalizeURL(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (url.pathname.endsWith('/') && url.pathname !== '/') {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return value;
  }
}
