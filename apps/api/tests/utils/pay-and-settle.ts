import type { APIRequestContext } from '@playwright/test';

export async function payInvoiceViaLNbits(opts: {
  payerUrl: string;
  payerKey: string;
  bolt11: string;
  waitMs?: number;
}): Promise<{ status: string }> {
  const { payerUrl, payerKey, bolt11, waitMs = 15000 } = opts;
  // LNbits pay endpoint: POST /api/v1/payments { out: true, bolt11 }
  const res = await fetch(`${payerUrl}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'X-Api-Key': payerKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ out: true, bolt11 })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`payInvoice failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const checking = data?.payment_hash ?? data?.checking_id ?? '';
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const s = await fetch(`${payerUrl}/api/v1/payments/${checking}`, {
      headers: { 'X-Api-Key': payerKey }
    });
    const sj = await s.json();
    if (sj?.paid === true || sj?.status === 'paid' || sj?.status === 'complete') {
      return { status: 'paid' };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { status: 'timeout' };
}

export async function waitForPaymentStatus(opts: {
  api: APIRequestContext;
  statusUrl: string;
  expect?: string[];
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const { api, statusUrl, expect = ['PAID', 'COMPLETED', 'SETTLED'], timeoutMs = 15000, intervalMs = 500 } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await api.get(statusUrl);
    if (res.status() === 404) {
      await delay(intervalMs);
      continue;
    }
    const body = await res.json();
    const status = (body.status || '').toString().toUpperCase();
    if (expect.includes(status)) return { status, body };
    await delay(intervalMs);
  }
  return { status: 'timeout' };
}

export async function lnbitsBalance(opts: { url: string; key: string }) {
  const res = await fetch(`${opts.url}/api/v1/wallet`, {
    headers: { 'X-Api-Key': opts.key }
  });
  if (!res.ok) throw new Error(`wallet fetch failed ${res.status}`);
  const body = await res.json();
  return body?.balance ?? body?.balance_msat ?? 0;
}

export async function settleAssert(opts: {
  api: APIRequestContext;
  payerUrl: string;
  payerKey: string;
  payUrl: string;
  amount: number; // sats
  expectDecreaseMsat?: number;
}) {
  const { api, payerUrl, payerKey, payUrl, amount, expectDecreaseMsat = amount * 1000 } = opts;
  const before = await lnbitsBalance({ url: payerUrl, key: payerKey });

  const payRes = await api.post(payUrl, {
    data: { out: false, amount, memo: 'settle-assert' },
    headers: { 'X-Api-Key': payerKey, 'Content-Type': 'application/json' }
  });
  if (!payRes.ok()) throw new Error(`pay request failed ${payRes.status()}`);
  const body = await payRes.json();
  const hash = body?.payment_hash || body?.checking_id;
  if (!hash) throw new Error('missing payment hash');

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const status = await fetch(`${payerUrl}/api/v1/payments/${hash}`, {
      headers: { 'X-Api-Key': payerKey }
    }).then((r) => r.json());
    if (status?.paid) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const after = await lnbitsBalance({ url: payerUrl, key: payerKey });
  if (!(after < before - expectDecreaseMsat + 2000)) { // allow small fee variance
    throw new Error(`balance did not drop enough: before=${before} after=${after}`);
  }
  return { before, after };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
