import type { FastifyBaseLogger } from 'fastify';

export type CreateChargeInput = {
  amount: number; // in sats
  description: string;
  descriptionHash?: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
};

type CreateChargeResponse = {
  data?: {
    id?: string;
    lightning_invoice?: { payreq?: string };
  };
};

type GetChargeResponse = {
  data?: {
    status?: string;
    amount?: number;
  };
};

export class OpenNodeProvider {
  private readonly apiKey: string;
  private readonly logger: FastifyBaseLogger;

  constructor(apiKey: string, logger: FastifyBaseLogger) {
    this.apiKey = apiKey;
    this.logger = logger;
  }

  async createCharge(input: CreateChargeInput) {
    // In tests or when using a clearly fake key, return a stubbed invoice to avoid external calls.
    const isMock = process.env.NODE_ENV === 'test' || this.apiKey.startsWith('test');
    if (isMock) {
      const id = `stub-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const invoice = `lnbc1p0mockpp5${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        invoice,
        amount: input.amount
      };
    }

    const body = {
      amount: input.amount,
      currency: 'BTC',
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {}
    };

    const res = await fetch('https://api.opennode.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OPN-API-KEY': this.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error({ status: res.status, text }, 'OpenNode charge failed');
      throw new Error(`OpenNode createCharge failed: ${res.status}`);
    }

    const json = (await res.json()) as CreateChargeResponse;
    const invoice = json?.data?.lightning_invoice?.payreq;
    const id = json?.data?.id;
    if (!invoice || !id) {
      this.logger.error({ json }, 'OpenNode response missing invoice');
      throw new Error('OpenNode response missing invoice');
    }

    return { id, invoice, amount: input.amount };
  }

  async getCharge(id: string) {
    const isMock = process.env.NODE_ENV === 'test' || this.apiKey.startsWith('test');
    if (isMock) {
      return { status: 'paid', amount: 1 };
    }

    const res = await fetch(`https://api.opennode.com/v2/charge/${encodeURIComponent(id)}`, {
      headers: { 'X-OPN-API-KEY': this.apiKey }
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn({ status: res.status, text }, 'OpenNode getCharge failed');
      throw new Error('OpenNode getCharge failed');
    }
    const json = (await res.json()) as GetChargeResponse;
    const status = json?.data?.status?.toLowerCase?.();
    const amount = json?.data?.amount;
    return { status, amount };
  }
}
