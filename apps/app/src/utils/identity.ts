import { nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';

import { type ApiBaseResolution, resolveGalleryApiBase } from './api-base';

export type IdentitySource = 'npub' | 'nprofile' | 'hex' | 'nip05';

export type IdentityResult = {
  pubkey: string;
  source: IdentitySource;
  nip05?: string;
  relays?: string[];
  lightning?: string;
  verified?: boolean;
};

export type IdentityErrorCode =
  | 'empty'
  | 'invalid_format'
  | 'decode_failed'
  | 'nip05_not_found'
  | 'nip05_timeout'
  | 'nip05_invalid'
  | 'nip05_error'
  | 'lightning_only';

export type IdentityError = {
  code: IdentityErrorCode;
  message: string;
  lightning?: string;
};

export type IdentityResolution =
  | { ok: true; value: IdentityResult }
  | { ok: false; error: IdentityError };

export type ResolveIdentityOptions = {
  apiBase?: string;
  apiBaseConfig?: ApiBaseResolution;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const HEX_RE = /^[0-9a-f]{64}$/i;
const NIP05_RE = /^[^@\s]+@[^@\s]+$/;

const ERROR_MESSAGES: Record<IdentityErrorCode, string> = {
  empty: 'Enter a Nostr identifier to search.',
  invalid_format: 'That does not look like a supported Nostr identifier.',
  decode_failed: 'Unable to decode that identifier.',
  nip05_not_found: 'No NIP-05 identity found for that name.',
  nip05_timeout: 'NIP-05 lookup timed out. Try again.',
  nip05_invalid: 'NIP-05 response was invalid.',
  nip05_error: 'Unable to resolve NIP-05 identity right now.',
  lightning_only: 'Lightning address detected, but no Nostr profile was found.'
};

function buildError(code: IdentityErrorCode, extras: Partial<IdentityError> = {}): IdentityError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    ...extras
  };
}

function normalizeInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^nostr:/i, '');
}

function normalizeLightningAddress(value: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('@')) return trimmed;
  return null;
}

function parseBech32(input: string): IdentityResolution | null {
  const lower = input.toLowerCase();
  if (!lower.startsWith('npub') && !lower.startsWith('nprofile')) {
    return null;
  }
  try {
    const decoded = nip19.decode(lower);
    if (decoded.type === 'npub') {
      const data = decoded.data as unknown;
      const pubkey = data instanceof Uint8Array ? bytesToHex(data) : String(data);
      if (!HEX_RE.test(pubkey)) return { ok: false, error: buildError('decode_failed') };
      return { ok: true, value: { pubkey: pubkey.toLowerCase(), source: 'npub' } };
    }
    if (decoded.type === 'nprofile') {
      const data = decoded.data as { pubkey?: string | Uint8Array; relays?: string[] };
      const pubkeyRaw = data?.pubkey;
      const pubkey =
        pubkeyRaw instanceof Uint8Array ? bytesToHex(pubkeyRaw) : String(pubkeyRaw ?? '');
      if (!HEX_RE.test(pubkey)) return { ok: false, error: buildError('decode_failed') };
      const relays = Array.isArray(data?.relays)
        ? data.relays
            .filter((relay) => typeof relay === 'string' && relay.trim())
            .map((relay) => relay.trim())
        : undefined;
      return {
        ok: true,
        value: {
          pubkey: pubkey.toLowerCase(),
          source: 'nprofile',
          relays: relays && relays.length ? relays : undefined
        }
      };
    }
    return { ok: false, error: buildError('invalid_format') };
  } catch {
    return { ok: false, error: buildError('decode_failed') };
  }
}

async function resolveNip05(
  nip05: string,
  options: ResolveIdentityOptions
): Promise<IdentityResolution> {
  const { apiBase, apiBaseConfig, timeoutMs = 3000, signal } = options;
  const apiConfig = resolveGalleryApiBase({ apiBase, apiBaseConfig });
  const base = apiConfig.baseUrl || '';
  const url = `${base}/api/nostr/identity?nip05=${encodeURIComponent(nip05)}`;

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: buildError('nip05_not_found') };
      if (res.status === 400) return { ok: false, error: buildError('nip05_invalid') };
      if (res.status === 504) return { ok: false, error: buildError('nip05_timeout') };
      return { ok: false, error: buildError('nip05_error') };
    }
    const body = (await res.json()) as { pubkey?: string; relays?: string[]; nip05?: string };
    if (!body?.pubkey || !HEX_RE.test(body.pubkey)) {
      return { ok: false, error: buildError('nip05_invalid') };
    }
    return {
      ok: true,
      value: {
        pubkey: body.pubkey.toLowerCase(),
        source: 'nip05',
        nip05,
        relays: Array.isArray(body.relays) ? body.relays : undefined,
        verified: true
      }
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: buildError('nip05_timeout') };
    }
    return { ok: false, error: buildError('nip05_error') };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function resolveIdentity(
  input: string,
  options: ResolveIdentityOptions = {}
): Promise<IdentityResolution> {
  const normalized = normalizeInput(input);
  if (!normalized) return { ok: false, error: buildError('empty') };

  if (HEX_RE.test(normalized)) {
    return { ok: true, value: { pubkey: normalized.toLowerCase(), source: 'hex' } };
  }

  const bech32Resolved = parseBech32(normalized);
  if (bech32Resolved) return bech32Resolved;

  const lower = normalized.toLowerCase();
  if (NIP05_RE.test(lower)) {
    const nip05Result = await resolveNip05(lower, options);
    if (nip05Result.ok) return nip05Result;
    const lightning = normalizeLightningAddress(lower);
    if (
      lightning &&
      (nip05Result.error.code === 'nip05_not_found' || nip05Result.error.code === 'nip05_invalid')
    ) {
      return { ok: false, error: buildError('lightning_only', { lightning }) };
    }
    return nip05Result;
  }

  const lightning = normalizeLightningAddress(lower);
  if (lightning) {
    return { ok: false, error: buildError('lightning_only', { lightning }) };
  }

  return { ok: false, error: buildError('invalid_format') };
}

export function describeIdentityError(error: IdentityError) {
  return error.message;
}
