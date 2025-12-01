import type { FastifyBaseLogger } from 'fastify';

export type LnbitsConfig = {
  baseUrl: string;
  apiKey: string;
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
    const json = (await res.json()) as any;
    const invoice = json?.payment_request;
    const id = json?.payment_hash || json?.checking_id;
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
    const json = (await res.json()) as any;
    const paid = json?.paid === true;
    const status = paid ? 'paid' : json?.pending === false ? 'failed' : 'pending';
    return { status };
  }
}
