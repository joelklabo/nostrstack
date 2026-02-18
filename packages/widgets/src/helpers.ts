/**
 * Helper utilities for embed widgets
 */

import { NostrstackClient } from '@nostrstack/sdk';

import { MIN_SEND_AMOUNT_MSAT } from './config.js';
import { isMockBase } from './url-utils.js';

export interface LnurlClient {
  getLnurlpMetadata(username: string): Promise<{
    callback: string;
    minSendable: number;
    maxSendable: number;
    metadata: string;
    tag: string;
  }>;
  getLnurlpInvoice(
    username: string,
    amountMsat: number
  ): Promise<{
    pr: string;
    routes: unknown[];
  }>;
}

/**
 * Create an LNURL client, with mock support for testing
 */
export function createClient(opts: { baseURL?: string; host?: string }): LnurlClient {
  if (isMockBase(opts.baseURL)) {
    return {
      async getLnurlpMetadata(username: string) {
        return {
          callback: 'mock',
          minSendable: MIN_SEND_AMOUNT_MSAT,
          maxSendable: 1_000_000,
          metadata: JSON.stringify([['text/plain', `mock lnurlp for ${username}`]]),
          tag: 'payRequest'
        };
      },
      async getLnurlpInvoice(_username: string, amountMsat: number) {
        const amount = Math.max(MIN_SEND_AMOUNT_MSAT, Math.round(amountMsat));
        return { pr: `lnbc1mock${amount}`, routes: [] };
      }
    };
  }

  return new NostrstackClient({
    baseURL: opts.baseURL,
    host: opts.host
  });
}

const ATTR_PREFIXES = ['ns'];

/**
 * Get a branded data attribute value from an element
 */
export function getBrandAttr(el: HTMLElement, key: 'Tip' | 'Pay' | 'Comments'): string | undefined {
  for (const prefix of ATTR_PREFIXES) {
    const val = (el.dataset as Record<string, string | undefined>)[`${prefix}${key}`];
    if (val !== undefined) return val;
  }
  return undefined;
}

/**
 * Set a branded data attribute on an element
 */
export function setBrandAttr(
  el: HTMLElement,
  key: 'Tip' | 'Pay' | 'Comments',
  value: string
): void {
  (el.dataset as Record<string, string>)[`ns${key}`] = value;
}

/**
 * Resolve tenant domain from options or window location
 */
export function resolveTenantDomain(host?: string): string | null {
  if (host && host.trim()) return host.trim();
  if (typeof window === 'undefined') return null;
  const h = window.location.host || window.location.hostname;
  return h ? h : null;
}

/**
 * Safely parse JSON, returning undefined on error
 */
export function parseMaybeJson(raw: unknown): unknown | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function toAuthOrMessage(error: unknown, fallback = 'Failed to generate invoice'): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '');
  if (!message) return fallback;

  const normalized = message.toLowerCase();
  if (
    normalized.includes('access_denied') ||
    normalized.includes('access denied') ||
    normalized.includes('not authenticated') ||
    normalized.includes('authentication required')
  ) {
    return 'Authentication required. Please sign in to continue.';
  }
  if (normalized.includes(' 401') || normalized.includes('401 ') || normalized.includes(' 403')) {
    return 'Authentication required. Please sign in to continue.';
  }
  if (message === '[object Object]') return fallback;
  return message;
}

/**
 * Extract provider reference from payment event message
 */
export function extractPayEventProviderRef(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.providerRef === 'string') return rec.providerRef;
  if (typeof rec.provider_ref === 'string') return rec.provider_ref;
  return null;
}

/**
 * Extract invoice from payment event message
 */
export function extractPayEventInvoice(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.pr === 'string') return rec.pr;
  if (typeof rec.payment_request === 'string') return rec.payment_request;
  return null;
}

/**
 * Format relative time for display (e.g., "5s", "3m")
 */
export function formatRelativeTime(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  return `${Math.round(seconds / 60)}m`;
}

/**
 * Format countdown time (MM:SS format)
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
