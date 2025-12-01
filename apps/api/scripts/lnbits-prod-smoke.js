#!/usr/bin/env node
// Simple smoke: check health + create invoice on prod LNbits. Skips if admin key missing.
const url = process.env.LNBITS_URL || 'https://lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io';
const key = process.env.LNBITS_PROD_ADMIN_KEY;

async function main() {
  if (!key) {
    console.log('SKIP: set LNBITS_PROD_ADMIN_KEY to run prod smoke');
    return;
  }
  console.log(`LNbits smoke against ${url}`);

  const healthRes = await fetch(`${url}/status/health`);
  if (!healthRes.ok) throw new Error(`health ${healthRes.status}`);
  const health = await healthRes.json();
  console.log('health:', health);

  const invoiceRes = await fetch(`${url}/api/v1/payments`, {
    method: 'POST',
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ out: false, amount: 100, memo: 'prod-smoke' })
  });
  if (!invoiceRes.ok) throw new Error(`invoice ${invoiceRes.status}`);
  const body = await invoiceRes.json();
  const pr = body?.payment_request;
  const hash = body?.payment_hash || body?.checking_id;
  if (!pr || !hash) throw new Error('missing invoice fields');
  console.log('invoice hash:', hash);
  console.log('BOLT11:', pr);
  console.log('Status expected: pending until paid');
}

main().catch((err) => {
  console.error('prod smoke failed:', err);
  process.exit(1);
});
