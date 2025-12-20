import { TextDecoder, TextEncoder } from 'util';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  decodeLnurl,
  encodeLnurl,
  normalizeLightningAddress,
  parseLnurlPayMetadata,
  sanitizeSuccessAction
} from './lnurl';

beforeAll(() => {
  vi.stubGlobal('TextEncoder', TextEncoder as unknown as typeof globalThis.TextEncoder);
  vi.stubGlobal('TextDecoder', TextDecoder as unknown as typeof globalThis.TextDecoder);
});

describe('LNURL helpers', () => {
  it('decodes LNURL bech32 strings', () => {
    const url = 'https://example.com/.well-known/lnurlp/alice';
    const encoded =
      'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf09emk2mrv944kummhdchkcmn4wfk8qtmpd35kxeg9saevq';
    expect(decodeLnurl(encoded)).toBe(url);
  });

  it('returns null for invalid LNURL encodes', () => {
    expect(encodeLnurl('not a url')).toBeNull();
  });

  it('normalizes lightning addresses and lnurl strings', () => {
    const url = 'https://example.com/.well-known/lnurlp/alice';
    const encoded =
      'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf09emk2mrv944kummhdchkcmn4wfk8qtmpd35kxeg9saevq';
    expect(normalizeLightningAddress('alice@example.com')).toBe('alice@example.com');
    expect(normalizeLightningAddress(url)).toBe(url);
    expect(normalizeLightningAddress(encoded)).toBe(url);
    expect(normalizeLightningAddress('   ')).toBeNull();
  });

  it('parses payRequest metadata and enforces limits', () => {
    const parsed = parseLnurlPayMetadata({
      tag: 'payRequest',
      callback: 'https://example.com/lnurl/callback',
      minSendable: 1000,
      maxSendable: 2000,
      metadata: '[]',
      commentAllowed: 0
    });
    expect(parsed.tag).toBe('payRequest');
    expect(parsed.commentAllowed).toBe(0);
  });

  it('rejects invalid metadata and limits', () => {
    expect(() => parseLnurlPayMetadata({
      tag: 'withdrawRequest',
      callback: 'https://example.com/lnurl/callback',
      minSendable: 1000,
      maxSendable: 2000,
      metadata: '[]'
    })).toThrow(/payRequest/i);

    expect(() => parseLnurlPayMetadata({
      tag: 'payRequest',
      callback: 'http://example.com/lnurl/callback',
      minSendable: 1000,
      maxSendable: 2000,
      metadata: '[]'
    })).toThrow(/https/i);

    expect(() => parseLnurlPayMetadata({
      tag: 'payRequest',
      callback: 'https://example.com/lnurl/callback',
      minSendable: 3000,
      maxSendable: 2000,
      metadata: '[]'
    })).toThrow(/limits/i);
  });

  it('sanitizes success actions', () => {
    expect(sanitizeSuccessAction({ tag: 'message', message: 'Thanks!' })).toEqual({
      tag: 'message',
      message: 'Thanks!'
    });

    expect(sanitizeSuccessAction({ tag: 'url', url: 'https://example.com', description: 'Visit' })).toEqual({
      tag: 'url',
      url: 'https://example.com/',
      description: 'Visit'
    });

    expect(sanitizeSuccessAction({ tag: 'url', url: 'javascript:alert(1)' })).toBeNull();

    expect(sanitizeSuccessAction({ tag: 'aes', ciphertext: 'abc', iv: 'def' })).toEqual({
      tag: 'aes',
      ciphertext: 'abc',
      iv: 'def',
      description: undefined
    });
  });
});
