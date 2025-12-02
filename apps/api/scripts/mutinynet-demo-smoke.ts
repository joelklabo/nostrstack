#!/usr/bin/env tsx
/**
 * Mutinynet smoke:
 * - Assumes API is running locally (default http://localhost:3001) pointing to mutinynet LNbits
 * - Verifies /health and /health/lnbits
 * - Requests an invoice via /api/pay (does not attempt to pay it)
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';
const AMOUNT = Number(process.env.AMOUNT ?? 5);

async function main() {
  console.log(`🔍 ${API_BASE}/health`);
  const h = await fetch(`${API_BASE}/health`);
  if (!h.ok) throw new Error(`/health ${h.status}`);

  console.log(`🔍 ${API_BASE}/health/lnbits`);
  const l = await fetch(`${API_BASE}/health/lnbits`);
  if (!l.ok) throw new Error(`/health/lnbits ${l.status}`);
  const ljson = await l.json();
  console.log('LNbits health:', ljson);

  console.log('🧾 requesting invoice...');
  const payRes = await fetch(`${API_BASE}/api/pay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'mutinynet' },
    body: JSON.stringify({
      domain: 'mutinynet',
      action: 'smoke',
      amount: AMOUNT,
      metadata: { ui: 'smoke' }
    })
  });
  const txt = await payRes.text();
  if (!payRes.ok) throw new Error(`/api/pay ${payRes.status}: ${txt}`);
  const body = JSON.parse(txt) as { payment_request?: string; pr?: string };
  const pr = body.payment_request ?? body.pr;
  if (!pr) throw new Error('invoice missing');
  console.log(`✅ invoice prefix: ${pr.slice(0, 20)}...`);
}

main().catch((err) => {
  console.error('❌ smoke failed', err);
  process.exit(1);
});
