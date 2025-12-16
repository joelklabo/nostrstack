#!/usr/bin/env tsx
/**
 * Smoke test for the local regtest demo:
 * - Assumes regtest stack is up (`./scripts/regtest-lndbits.sh up`)
 * - Assumes API is running at http(s)://localhost:3001 pointing to that LNbits
 * - Creates an invoice via /api/pay
 * - Pays it using the payer LND node (docker compose exec lncli payinvoice)
 * - Polls status until PAID
 */

import { execSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath,URL } from 'node:url';

function normalizeBase(base: string) {
  return base.replace(/\/+$/, '');
}

const DEFAULT_API_BASE =
  process.env.PUBLIC_ORIGIN ??
  (process.env.USE_HTTPS === 'false' ? 'http://localhost:3001' : 'https://localhost:3001');
const API_BASE = normalizeBase(process.env.API_BASE ?? DEFAULT_API_BASE);
const AMOUNT = Number(process.env.AMOUNT ?? 123);
const ACTION = process.env.ACTION ?? 'regtest-smoke';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REGTEST_COMPOSE = path.join(ROOT, 'deploy', 'regtest', 'docker-compose.yml');

function shouldAllowInsecureLocalTls(base: string) {
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
}

async function requestText(url: string, opts: { method?: string; headers?: Record<string, string>; body?: string; insecure?: boolean } = {}) {
  const parsed = new URL(url);
  const lib = parsed.protocol === 'https:' ? https : http;
  const insecure = opts.insecure === true && parsed.protocol === 'https:';

  const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: opts.method ?? 'GET',
        headers: opts.headers,
        ...(insecure ? { rejectUnauthorized: false } : {})
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });

  return res;
}

async function requestJson<T>(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string; insecure?: boolean } = {}
) {
  const res = await requestText(url, opts);
  return { ...res, json: JSON.parse(res.body) as T };
}

async function main() {
  const insecure = shouldAllowInsecureLocalTls(API_BASE);
  console.log(`🔍 Hitting ${API_BASE}/api/pay ...`);
  const payRes = await requestText(`${API_BASE}/api/pay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      domain: 'localhost',
      action: ACTION,
      amount: AMOUNT
    }),
    insecure
  });
  if (payRes.status < 200 || payRes.status >= 300) {
    throw new Error(`pay request failed ${payRes.status}: ${payRes.body}`);
  }
  const payJson = JSON.parse(payRes.body) as {
    payment_request: string;
    provider_ref: string;
  };
  console.log(`✅ Invoice created: ${payJson.payment_request.slice(0, 32)}...`);

  console.log('💸 Paying via lnd-payer...');
  execSync(
    `docker compose -f "${REGTEST_COMPOSE}" exec lnd-payer ` +
      `lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 ` +
      `--macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon ` +
      `--tlscertpath=/data/tls.cert payinvoice --force --json "${payJson.payment_request}"`,
    { stdio: 'inherit' }
  );

  console.log('⏳ Polling status...');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const statusRes = await requestJson<{ status: string }>(
      `${API_BASE}/api/lnurlp/pay/status/${encodeURIComponent(payJson.provider_ref)}`,
      { insecure }
    );
    if (statusRes.json.status?.toUpperCase?.() === 'PAID') {
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
