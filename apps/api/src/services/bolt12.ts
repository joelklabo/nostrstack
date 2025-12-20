import type { FastifyBaseLogger } from 'fastify';

export type Bolt12OfferRequest = {
  amountMsat?: number;
  description: string;
  label?: string;
  issuer?: string;
  expiresIn?: number;
};

export type Bolt12OfferResponse = {
  offer: string;
  offerId?: string;
  label?: string;
};

export type Bolt12InvoiceRequest = {
  offer: string;
  amountMsat?: number;
  quantity?: number;
  payerNote?: string;
};

export type Bolt12InvoiceResponse = {
  invoice: string;
};

export interface Bolt12Provider {
  createOffer(input: Bolt12OfferRequest): Promise<Bolt12OfferResponse>;
  fetchInvoice(input: Bolt12InvoiceRequest): Promise<Bolt12InvoiceResponse>;
}

type ClnRestConfig = {
  baseUrl: string;
  apiKey?: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export class ClnRestBolt12Provider implements Bolt12Provider {
  private readonly baseUrl: string;

  constructor(private readonly config: ClnRestConfig, private readonly log: FastifyBaseLogger) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  private headers() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers['X-Api-Key'] = this.config.apiKey;
    return headers;
  }

  private async postJson(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      this.log.error({ status: res.status, text, path }, 'BOLT12 provider request failed');
      throw new Error('BOLT12 provider request failed');
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  async createOffer(input: Bolt12OfferRequest): Promise<Bolt12OfferResponse> {
    const payload: Record<string, unknown> = {
      description: input.description
    };
    if (input.amountMsat !== undefined) payload.amount_msat = input.amountMsat;
    if (input.label) payload.label = input.label;
    if (input.issuer) payload.issuer = input.issuer;
    if (input.expiresIn !== undefined) payload.expiry = input.expiresIn;

    const json = await this.postJson('/v1/offer', payload);
    const offer = pickString(json, ['bolt12', 'offer']);
    if (!offer) {
      this.log.error({ json }, 'BOLT12 offer response missing offer');
      throw new Error('BOLT12 offer response missing offer');
    }
    return {
      offer,
      offerId: pickString(json, ['offer_id', 'offerId', 'id']),
      label: pickString(json, ['label'])
    };
  }

  async fetchInvoice(input: Bolt12InvoiceRequest): Promise<Bolt12InvoiceResponse> {
    const payload: Record<string, unknown> = { offer: input.offer };
    if (input.amountMsat !== undefined) payload.amount_msat = input.amountMsat;
    if (input.quantity !== undefined) payload.quantity = input.quantity;
    if (input.payerNote) payload.payer_note = input.payerNote;

    const json = await this.postJson('/v1/fetchinvoice', payload);
    const invoice = pickString(json, ['invoice', 'bolt11', 'pay_req', 'payment_request']);
    if (!invoice) {
      this.log.error({ json }, 'BOLT12 fetchinvoice response missing invoice');
      throw new Error('BOLT12 fetchinvoice response missing invoice');
    }
    return { invoice };
  }
}

export class MockBolt12Provider implements Bolt12Provider {
  async createOffer(): Promise<Bolt12OfferResponse> {
    throw new Error('BOLT12 mock provider is not configured');
  }

  async fetchInvoice(): Promise<Bolt12InvoiceResponse> {
    throw new Error('BOLT12 mock provider is not configured');
  }
}
