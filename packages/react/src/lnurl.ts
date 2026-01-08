import { bech32 } from '@scure/base';
import { Buffer } from 'buffer';
import type { EventTemplate } from 'nostr-tools';

const PAID_STATUSES = new Set(['PAID', 'SETTLED', 'CONFIRMED', 'COMPLETED', 'SUCCESS']);

export type LnurlPayMetadata = {
  tag: 'payRequest';
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  commentAllowed?: number;
  encoded?: string;
};

export type LnurlSuccessAction = {
  tag?: string;
  message?: string;
  url?: string;
  description?: string;
  ciphertext?: string;
  iv?: string;
};

export function decodeLnurl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('lnurl')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { words } = bech32.decode(lower as any, 1000);
      const data = bech32.fromWords(words);
      return new TextDecoder().decode(new Uint8Array(data));
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

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]'
  );
}

export function validateLnurlCallbackUrl(callback: string, allowHttp: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(callback);
  } catch {
    throw new Error('LNURL metadata callback is invalid.');
  }
  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && (allowHttp || isLocalhost(parsed.hostname))) return;
  throw new Error('LNURL callback must use https.');
}

export function parseLnurlPayMetadata(
  raw: Record<string, unknown>,
  options: { allowHttp?: boolean } = {}
): LnurlPayMetadata {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LNURL metadata is invalid.');
  }
  if (raw.tag !== 'payRequest') {
    throw new Error('LNURL does not support payRequest (NIP-57).');
  }
  const callback = typeof raw.callback === 'string' ? raw.callback : '';
  if (!callback) {
    throw new Error('LNURL metadata missing callback URL.');
  }
  validateLnurlCallbackUrl(callback, Boolean(options.allowHttp));

  const minSendable = Number(raw.minSendable);
  const maxSendable = Number(raw.maxSendable);
  if (!Number.isFinite(minSendable) || !Number.isFinite(maxSendable)) {
    throw new Error('LNURL metadata missing sendable limits.');
  }
  if (minSendable > maxSendable) {
    throw new Error('LNURL metadata has invalid sendable limits.');
  }

  const metadata = typeof raw.metadata === 'string' ? raw.metadata : '';
  if (!metadata) {
    throw new Error('LNURL metadata missing metadata string.');
  }

  const commentAllowedRaw = raw.commentAllowed;
  const commentAllowedNum = Number(commentAllowedRaw);
  const commentAllowed = Number.isFinite(commentAllowedNum)
    ? Math.max(0, Math.floor(commentAllowedNum))
    : undefined;

  return {
    tag: 'payRequest',
    callback,
    minSendable,
    maxSendable,
    metadata,
    commentAllowed,
    encoded: typeof raw.encoded === 'string' ? raw.encoded : undefined
  };
}

export function sanitizeSuccessAction(raw: unknown): LnurlSuccessAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as LnurlSuccessAction;
  const tag = typeof candidate.tag === 'string' ? candidate.tag.toLowerCase() : '';
  if (tag === 'message') {
    return {
      tag: 'message',
      message: typeof candidate.message === 'string' ? candidate.message : undefined
    };
  }
  if (tag === 'url') {
    if (typeof candidate.url !== 'string') return null;
    try {
      const parsed = new URL(candidate.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return {
        tag: 'url',
        url: parsed.toString(),
        description: typeof candidate.description === 'string' ? candidate.description : undefined
      };
    } catch {
      return null;
    }
  }
  if (tag === 'aes') {
    return {
      tag: 'aes',
      ciphertext: typeof candidate.ciphertext === 'string' ? candidate.ciphertext : undefined,
      iv: typeof candidate.iv === 'string' ? candidate.iv : undefined,
      description: typeof candidate.description === 'string' ? candidate.description : undefined
    };
  }
  return null;
}
