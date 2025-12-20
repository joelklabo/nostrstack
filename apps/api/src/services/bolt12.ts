import { randomBytes } from 'node:crypto';

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

export type Bolt12Limits = {
  minAmountMsat: number;
  maxAmountMsat: number;
  minExpirySeconds: number;
  maxExpirySeconds: number;
  maxDescriptionChars: number;
  maxLabelChars: number;
  maxIssuerChars: number;
  maxPayerNoteChars: number;
  maxQuantity: number;
};

export class Bolt12ValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'Bolt12ValidationError';
  }
}

export class Bolt12GuardrailError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'Bolt12GuardrailError';
  }
}

export interface Bolt12Provider {
  createOffer(input: Bolt12OfferRequest): Promise<Bolt12OfferResponse>;
  fetchInvoice(input: Bolt12InvoiceRequest): Promise<Bolt12InvoiceResponse>;
}

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireNonEmpty(value: string, code: string, message: string) {
  if (!value.trim()) {
    throw new Bolt12ValidationError(code, message);
  }
  return value.trim();
}

function assertSafeInteger(value: number, code: string, message: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Bolt12ValidationError(code, message);
  }
}

function assertRange(value: number, min: number, max: number, code: string, message: string) {
  if (value < min || value > max) {
    throw new Bolt12ValidationError(code, message);
  }
}

export function validateBolt12OfferInput(input: Bolt12OfferRequest, limits: Bolt12Limits): Bolt12OfferRequest {
  const description = requireNonEmpty(input.description, 'bolt12_description_required', 'Description is required.');
  if (description.length > limits.maxDescriptionChars) {
    throw new Bolt12ValidationError(
      'bolt12_description_too_long',
      `Description must be ${limits.maxDescriptionChars} characters or fewer.`
    );
  }

  const amountMsat = input.amountMsat;
  if (amountMsat !== undefined) {
    assertSafeInteger(amountMsat, 'bolt12_amount_invalid', 'Amount must be a whole number of millisats.');
    assertRange(
      amountMsat,
      limits.minAmountMsat,
      limits.maxAmountMsat,
      'bolt12_amount_out_of_range',
      `Amount must be between ${limits.minAmountMsat} and ${limits.maxAmountMsat} msat.`
    );
  }

  const label = normalizeOptional(input.label);
  if (label && label.length > limits.maxLabelChars) {
    throw new Bolt12ValidationError(
      'bolt12_label_too_long',
      `Label must be ${limits.maxLabelChars} characters or fewer.`
    );
  }

  const issuer = normalizeOptional(input.issuer);
  if (issuer && issuer.length > limits.maxIssuerChars) {
    throw new Bolt12ValidationError(
      'bolt12_issuer_too_long',
      `Issuer must be ${limits.maxIssuerChars} characters or fewer.`
    );
  }

  const expiresIn = input.expiresIn;
  if (expiresIn !== undefined) {
    assertSafeInteger(expiresIn, 'bolt12_expiry_invalid', 'Expiry must be a whole number of seconds.');
    assertRange(
      expiresIn,
      limits.minExpirySeconds,
      limits.maxExpirySeconds,
      'bolt12_expiry_out_of_range',
      `Expiry must be between ${limits.minExpirySeconds} and ${limits.maxExpirySeconds} seconds.`
    );
  }

  return {
    description,
    amountMsat,
    label,
    issuer,
    expiresIn
  };
}

export function validateBolt12InvoiceInput(input: Bolt12InvoiceRequest, limits: Bolt12Limits): Bolt12InvoiceRequest {
  const offer = requireNonEmpty(input.offer, 'bolt12_offer_required', 'Offer is required.');

  const amountMsat = input.amountMsat;
  if (amountMsat !== undefined) {
    assertSafeInteger(amountMsat, 'bolt12_amount_invalid', 'Amount must be a whole number of millisats.');
    assertRange(
      amountMsat,
      limits.minAmountMsat,
      limits.maxAmountMsat,
      'bolt12_amount_out_of_range',
      `Amount must be between ${limits.minAmountMsat} and ${limits.maxAmountMsat} msat.`
    );
  }

  const quantity = input.quantity;
  if (quantity !== undefined) {
    assertSafeInteger(quantity, 'bolt12_quantity_invalid', 'Quantity must be a whole number.');
    assertRange(
      quantity,
      1,
      limits.maxQuantity,
      'bolt12_quantity_out_of_range',
      `Quantity must be between 1 and ${limits.maxQuantity}.`
    );
  }

  const payerNote = normalizeOptional(input.payerNote);
  if (payerNote && payerNote.length > limits.maxPayerNoteChars) {
    throw new Bolt12ValidationError(
      'bolt12_payer_note_too_long',
      `Payer note must be ${limits.maxPayerNoteChars} characters or fewer.`
    );
  }

  return {
    offer,
    amountMsat,
    quantity,
    payerNote
  };
}

export async function createBolt12Offer(provider: Bolt12Provider, input: Bolt12OfferRequest) {
  return provider.createOffer(input);
}

export async function fetchBolt12Invoice(provider: Bolt12Provider, input: Bolt12InvoiceRequest) {
  return provider.fetchInvoice(input);
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
  async createOffer(input: Bolt12OfferRequest): Promise<Bolt12OfferResponse> {
    const offerId = randomBytes(4).toString('hex');
    const offer = `lno1mock${offerId}${randomBytes(6).toString('hex')}`;
    return {
      offer,
      offerId,
      label: input.label
    };
  }

  async fetchInvoice(_input: Bolt12InvoiceRequest): Promise<Bolt12InvoiceResponse> {
    const invoice = `lni1mock${randomBytes(8).toString('hex')}`;
    return { invoice };
  }
}
