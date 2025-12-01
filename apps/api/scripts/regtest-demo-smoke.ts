#!/usr/bin/env tsx
/**
 * Smoke test for the local regtest demo:
 * - Assumes regtest stack is up (`./scripts/regtest-lndbits.sh up`)
 * - Assumes API is running at http://localhost:3001 pointing to that LNbits
 * - Creates an invoice via /api/pay
 * - Pays it using the payer LND node (docker compose exec lncli payinvoice)
 * - Polls status until PAID
 */

import { execSync } from 'node:child_process';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';
const AMOUNT = Number(process.env.AMOUNT ?? 123);
const ACTION = process.env.ACTION ?? 'regtest-smoke';

async function main() {
  console.log(`🔍 Hitting ${API_BASE}/api/pay ...`);
  const payRes = await fetch(`${API_BASE}/api/pay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      domain: 'default',
      action: ACTION,
      amount: AMOUNT
    })
  });
  if (!payRes.ok) {
    const text = await payRes.text();
    throw new Error(`pay request failed ${payRes.status}: ${text}`);
  }
  const payJson = (await payRes.json()) as {
    payment_request: string;
    provider_ref: string;
  };
  console.log(`✅ Invoice created: ${payJson.payment_request.slice(0, 32)}...`);

  console.log('💸 Paying via lnd-payer...');
  execSync(
    `docker compose -f deploy/regtest/docker-compose.yml exec lnd-payer ` +
      `lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 ` +
      `--macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon ` +
      `--tlscertpath=/data/tls.cert payinvoice --force --json "${payJson.payment_request}"`,
    { stdio: 'inherit' }
  );

  console.log('⏳ Polling status...');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `${API_BASE}/api/lnurlp/pay/status/${encodeURIComponent(payJson.provider_ref)}`
    );
    const statusJson = (await statusRes.json()) as { status: string };
    if (statusJson.status?.toUpperCase?.() === 'PAID') {
      console.log('🎉 Payment settled (PAID)');
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timed out waiting for payment to settle');
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err);
  process.exit(1);
});
