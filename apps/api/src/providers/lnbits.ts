import type { FastifyBaseLogger } from 'fastify';

type LnbitsConfig = {
  baseUrl: string;
  apiKey: string;
};

type CreateChargeResponse = {
  payment_request?: string;
  payment_hash?: string;
  checking_id?: string;
};

type GetChargeResponse = {
  paid?: boolean;
  pending?: boolean;
};

export class LnbitsProvider {
  constructor(private readonly cfg: LnbitsConfig, private readonly log: FastifyBaseLogger) {}

  private headers() {
    return { 'Content-Type': 'application/json', 'X-Api-Key': this.cfg.apiKey };
  }

  async createCharge(input: { amount: number; description: string }) {
    // amount in sats
    const body = { out: false, amount: input.amount, memo: input.description };
    const res = await fetch(`${this.cfg.baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      this.log.error({ status: res.status, text }, 'LNbits createCharge failed');
      throw new Error('LNbits createCharge failed');
    }
    const json = (await res.json()) as Record<string, unknown>;
    const invoice = (json.payment_request as string) || (json.pr as string);
    const id = (json.payment_hash as string) || (json.checking_id as string);
    if (!invoice || !id) {
      this.log.error({ json }, 'LNbits createCharge missing fields');
      throw new Error('LNbits createCharge missing fields');
    }
    return { id, invoice, amount: input.amount };
  }

  async getCharge(id: string) {
    const res = await fetch(`${this.cfg.baseUrl}/api/v1/payments/${encodeURIComponent(id)}`, {
      headers: this.headers()
    });
    if (!res.ok) {
      const text = await res.text();
      this.log.warn({ status: res.status, text }, 'LNbits getCharge failed');
      throw new Error('LNbits getCharge failed');
    }
    const json = (await res.json()) as Record<string, unknown>;
    const paid = json?.paid === true;
    const pending = json?.pending === true || json?.pending === undefined;
    const status = paid ? 'paid' : pending ? 'pending' : 'failed';
    return { status };
  }
}
