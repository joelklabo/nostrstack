import { bech32 } from '@scure/base';
import { Buffer } from 'buffer';
import type { EventTemplate } from 'nostr-tools';

const PAID_STATUSES = new Set(['PAID', 'SETTLED', 'CONFIRMED', 'COMPLETED', 'SUCCESS']);

export function decodeLnurl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('lnurl')) {
    try {
      const { words } = bech32.decode(lower, 1000);
      const data = bech32.fromWords(words);
      return new TextDecoder().decode(data);
    } catch {
      // ignore invalid bech32
    }
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.toLowerCase().startsWith('http')) return decoded;
  } catch {
    // ignore invalid base64
  }
  return null;
}

export function encodeLnurl(url: string): string | null {
  try {
    const normalized = new URL(url).toString();
    const words = bech32.toWords(new TextEncoder().encode(normalized));
    return bech32.encode('lnurl', words, 1000).toUpperCase();
  } catch {
    return null;
  }
}

export function normalizeLightningAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('@')) return trimmed;
  return decodeLnurl(trimmed);
}

export function deriveLnurlStatusUrl(callback: string, providerRef: string | null): string | null {
  if (!providerRef) return null;
  try {
    const url = new URL(callback);
    const segments = url.pathname.split('/').filter(Boolean);
    const lnurlIndex = segments.lastIndexOf('lnurlp');
    if (lnurlIndex === -1) return null;
    const username = segments[lnurlIndex + 1];
    const invoiceSegment = segments[lnurlIndex + 2];
    if (!username || invoiceSegment !== 'invoice') return null;
    url.pathname = `/api/lnurlp/${encodeURIComponent(username)}/status/${encodeURIComponent(providerRef)}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function isPaidStatus(status: unknown): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(String(status).toUpperCase());
}

export async function getLnurlpMetadata(lnurl: string): Promise<Record<string, unknown>> {
  const url = new URL(lnurl);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getLnurlpInvoice(
  callback: string,
  amountMsat: number,
  lnurl: string | null,
  event: EventTemplate
): Promise<Record<string, unknown>> {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMsat));
  url.searchParams.set('nostr', JSON.stringify(event));
  if (lnurl) {
    url.searchParams.set('lnurl', lnurl);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}
