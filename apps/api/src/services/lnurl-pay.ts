export type LnurlSuccessAction =
  | { tag: 'message'; message: string }
  | { tag: 'url'; url: string; description?: string }
  | { tag: 'aes'; ciphertext: string; iv: string; description?: string };

type ParseResult<T> = { value?: T; error?: string };

const SUCCESS_ACTION_LIMITS = {
  message: 144,
  description: 144,
  url: 1024,
  ciphertext: 4096,
  iv: 64
};

const METADATA_LIMITS = {
  type: 64,
  value: 1024,
  entries: 20
};

const ALLOWED_URL_PROTOCOLS = new Set(['https:', 'http:']);

function sanitizeString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function normalizeUrl(value: string): ParseResult<string> {
  try {
    const parsed = new URL(value);
    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      return { error: 'successAction.url must be http(s)' };
    }
    return { value: parsed.toString() };
  } catch {
    return { error: 'successAction.url is invalid' };
  }
}

export function parseLnurlSuccessAction(raw: string | null | undefined): ParseResult<LnurlSuccessAction> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { error: 'successAction must be valid JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'successAction must be an object' };
  }

  const rec = parsed as Record<string, unknown>;
  const tag = sanitizeString(rec.tag, 32)?.toLowerCase();
  if (!tag) {
    return { error: 'successAction.tag is required' };
  }

  if (tag === 'message') {
    const message = sanitizeString(rec.message, SUCCESS_ACTION_LIMITS.message);
    if (!message) return { error: 'successAction.message is required' };
    return { value: { tag: 'message', message } };
  }

  if (tag === 'url') {
    const urlValue = sanitizeString(rec.url, SUCCESS_ACTION_LIMITS.url);
    if (!urlValue) return { error: 'successAction.url is required' };
    const url = normalizeUrl(urlValue);
    if (url.error) return { error: url.error };
    const description = sanitizeString(rec.description, SUCCESS_ACTION_LIMITS.description);
    return {
      value: description
        ? { tag: 'url', url: url.value ?? urlValue, description }
        : { tag: 'url', url: url.value ?? urlValue }
    };
  }

  if (tag === 'aes') {
    const ciphertext = sanitizeString(rec.ciphertext, SUCCESS_ACTION_LIMITS.ciphertext);
    const iv = sanitizeString(rec.iv, SUCCESS_ACTION_LIMITS.iv);
    if (!ciphertext) return { error: 'successAction.ciphertext is required' };
    if (!iv) return { error: 'successAction.iv is required' };
    const description = sanitizeString(rec.description, SUCCESS_ACTION_LIMITS.description);
    return {
      value: description
        ? { tag: 'aes', ciphertext, iv, description }
        : { tag: 'aes', ciphertext, iv }
    };
  }

  return { error: 'successAction.tag must be message, url, or aes' };
}

export function normalizeLnurlMetadata(raw: string | null | undefined): ParseResult<string> {
  if (!raw) return { error: 'metadata is required' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { error: 'metadata must be valid JSON' };
  }

  if (!Array.isArray(parsed)) {
    return { error: 'metadata must be an array' };
  }

  const normalized: Array<[string, string]> = [];
  for (const entry of parsed) {
    if (!Array.isArray(entry) || entry.length < 2) {
      return { error: 'metadata entries must be [type, value]' };
    }
    const type = sanitizeString(entry[0], METADATA_LIMITS.type);
    const value = sanitizeString(entry[1], METADATA_LIMITS.value);
    if (!type || !value) {
      return { error: 'metadata entries must include type and value' };
    }
    normalized.push([type, value]);
    if (normalized.length >= METADATA_LIMITS.entries) break;
  }

  if (!normalized.length) {
    return { error: 'metadata must include at least one entry' };
  }

  return { value: JSON.stringify(normalized) };
}
