import { type Event, type EventTemplate, finalizeEvent, getPublicKey, SimplePool } from 'nostr-tools';
import * as nip04 from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';

import { type ParsedNwcUri,parseNwcUri } from './utils';

const REQUEST_KIND = 23194;
const RESPONSE_KIND = 23195;
const DEFAULT_TIMEOUT_MS = 15000;

export type NwcClientOptions = {
  uri: string;
  relays?: string[];
  timeoutMs?: number;
  preferNip44?: boolean;
};

export type NwcError = {
  code: string;
  message?: string;
};

export type NwcResponse<T> = {
  result_type?: string;
  result?: T;
  error?: NwcError | null;
};

export type NwcPayInvoiceResult = {
  preimage?: string;
  fees_paid?: number;
};

export type NwcBalanceResult = {
  balance: number;
};

type NwcRequestPayload = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

const NWC_ERROR_MESSAGES: Record<string, string> = {
  RESTRICTED: 'Wallet rejected the request.',
  UNAUTHORIZED: 'Wallet rejected the request.',
  NOT_IMPLEMENTED: 'Wallet does not support this method.',
  RATE_LIMITED: 'Wallet rate limited the request.',
  INTERNAL: 'Wallet had an internal error.',
  OTHER: 'Wallet request failed.',
  INVALID_PARAMS: 'Wallet rejected the request parameters.',
  INSUFFICIENT_BALANCE: 'Wallet has insufficient balance.',
  QUOTA_EXCEEDED: 'Wallet quota exceeded.',
  PAYMENT_FAILED: 'Payment failed.'
};

function formatNwcError(error: NwcError): string {
  const base = NWC_ERROR_MESSAGES[error.code] ?? error.message ?? 'Wallet request failed.';
  if (error.message && error.message !== base) {
    return `${base} (${error.message})`;
  }
  return base;
}

function generateRequestId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `nwc-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function encryptPayload(
  payload: NwcRequestPayload,
  secretKey: Uint8Array,
  walletPubkey: string,
  preferNip44: boolean
): string {
  const plaintext = JSON.stringify(payload);
  if (preferNip44) {
    try {
      const key = nip44.getConversationKey(secretKey, walletPubkey);
      return nip44.encrypt(plaintext, key);
    } catch {
      // fall back to nip04
    }
  }
  return nip04.encrypt(secretKey, walletPubkey, plaintext);
}

function decryptPayload(
  content: string,
  secretKey: Uint8Array,
  walletPubkey: string,
  preferNip44: boolean
): string {
  const attempts = preferNip44 ? ['nip44', 'nip04'] : ['nip04', 'nip44'];
  const errors: unknown[] = [];
  for (const attempt of attempts) {
    try {
      if (attempt === 'nip44') {
        const key = nip44.getConversationKey(secretKey, walletPubkey);
        return nip44.decrypt(content, key);
      }
      return nip04.decrypt(secretKey, walletPubkey, content);
    } catch (error) {
      errors.push(error);
    }
  }
  const error = errors.find(Boolean);
  throw error instanceof Error ? error : new Error('Failed to decrypt NWC response.');
}

function buildRequestEvent(
  payload: NwcRequestPayload,
  parsed: ParsedNwcUri,
  preferNip44: boolean
): { event: Event; requestId: string } {
  const created_at = Math.floor(Date.now() / 1000);
  const content = encryptPayload(payload, parsed.secret, parsed.walletPubkey, preferNip44);
  const template: EventTemplate = {
    kind: REQUEST_KIND,
    created_at,
    content,
    tags: [['p', parsed.walletPubkey]]
  };
  const event = finalizeEvent(template, parsed.secret);
  return { event, requestId: payload.id };
}

async function publishRequest(pool: SimplePool, relays: string[], event: Event): Promise<void> {
  const results = await Promise.allSettled(pool.publish(relays, event));
  const success = results.some(result => result.status === 'fulfilled');
  if (!success) {
    throw new Error('Failed to publish NWC request to any relay.');
  }
}

function waitForResponse(
  pool: SimplePool,
  relays: string[],
  requestId: string,
  clientPubkey: string,
  walletPubkey: string,
  timeoutMs: number
): Promise<Event> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const closer = pool.subscribeMany(relays, { kinds: [RESPONSE_KIND], '#p': [clientPubkey] }, {
      onevent(event) {
        if (settled) return;
        if (event.pubkey !== walletPubkey) return;
        const matches = event.tags.some(tag => tag[0] === 'e' && tag[1] === requestId);
        if (!matches) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        closer.close('received');
        resolve(event);
      },
      onclose(reasons) {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        reject(new Error(`NWC response stream closed: ${reasons.join(', ')}`));
      },
      maxWait: timeoutMs
    });

    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      closer.close('timeout');
      reject(new Error('NWC response timed out.'));
    }, timeoutMs);
  });
}

export class NwcClient {
  private readonly parsed: ParsedNwcUri;
  private readonly relays: string[];
  private readonly clientPubkey: string;
  private readonly timeoutMs: number;
  private readonly preferNip44: boolean;
  private readonly pool: SimplePool;

  constructor(options: NwcClientOptions) {
    this.parsed = parseNwcUri(options.uri);
    const overrideRelays = options.relays?.map(relay => relay.trim()).filter(Boolean);
    this.relays = (overrideRelays && overrideRelays.length ? overrideRelays : this.parsed.relays).slice();
    if (!this.relays.length) {
      throw new Error('No relays configured for NWC.');
    }
    this.clientPubkey = getPublicKey(this.parsed.secret);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.preferNip44 = options.preferNip44 ?? false;
    this.pool = new SimplePool();
  }

  close(): void {
    this.pool.close(this.relays);
  }

  async payInvoice(invoice: string, amountMsat?: number): Promise<NwcPayInvoiceResult> {
    const params: Record<string, unknown> = { invoice };
    if (typeof amountMsat === 'number') params.amount = amountMsat;
    return this.request<NwcPayInvoiceResult>('pay_invoice', params);
  }

  async getBalance(): Promise<NwcBalanceResult> {
    return this.request<NwcBalanceResult>('get_balance');
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const payload: NwcRequestPayload = {
      id: generateRequestId(),
      method,
      params
    };

    const { event, requestId } = buildRequestEvent(payload, this.parsed, this.preferNip44);
    await publishRequest(this.pool, this.relays, event);

    const responseEvent = await waitForResponse(
      this.pool,
      this.relays,
      requestId,
      this.clientPubkey,
      this.parsed.walletPubkey,
      this.timeoutMs
    );

    const decrypted = decryptPayload(
      responseEvent.content,
      this.parsed.secret,
      this.parsed.walletPubkey,
      this.preferNip44
    );

    let response: NwcResponse<T>;
    try {
      response = JSON.parse(decrypted) as NwcResponse<T>;
    } catch {
      throw new Error('Invalid NWC response payload.');
    }

    if (response.error) {
      throw new Error(formatNwcError(response.error));
    }
    if (response.result_type && response.result_type !== method) {
      throw new Error('Unexpected NWC response type.');
    }
    if (!('result' in response)) {
      throw new Error('NWC response missing result.');
    }
    return response.result as T;
  }
}
