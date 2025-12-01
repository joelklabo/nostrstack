#!/usr/bin/env node
import fetch from 'node-fetch';

const url = process.env.LNBITS_URL || 'https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io';
const key = process.env.LNBITS_STG_ADMIN_KEY || process.env.LNBITS_ADMIN_KEY;

async function main() {
  if (!key) {
    console.log('SKIP: LNBITS_STG_ADMIN_KEY not set');
    return;
  }

  console.log(`Using LNbits at ${url}`);
  const health = await fetch(`${url}/status/health`).then((r) => r.json());
  console.log('Health:', health);

  const invoiceRes = await fetch(`${url}/api/v1/payments`, {
    method: 'POST',
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ out: false, amount: 100, memo: 'mutinynet-smoke' })
  });
  if (!invoiceRes.ok) throw new Error(`invoice failed ${invoiceRes.status}`);
  const invoice = await invoiceRes.json();
  const pr = invoice?.payment_request;
  const hash = invoice?.payment_hash || invoice?.checking_id;
  if (!pr || !hash) throw new Error('missing invoice fields');
  console.log('Invoice:', pr.slice(0, 32) + '...');

  const statusUrl = `${url}/api/v1/payments/${hash}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(statusUrl, { headers: { 'X-Api-Key': key } });
    const status = await statusRes.json();
    if (status?.paid) {
      console.log('Status: paid');
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('timeout waiting for paid');
}

main().catch((err) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
