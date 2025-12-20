import { randomBytes } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { bech32 } from '@scure/base';

import { env } from '../env.js';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function encodeLnurl(url: string): string {
  const normalized = new URL(url).toString();
  const words = bech32.toWords(new TextEncoder().encode(normalized));
  return bech32.encode('lnurl', words, 1000).toUpperCase();
}

export function buildWithdrawLnurl(origin: string, k1: string) {
  const url = new URL(`/api/lnurl-withdraw/${k1}`, origin);
  return encodeLnurl(url.toString());
}

export async function createWithdrawSession(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    minWithdrawable: number;
    maxWithdrawable: number;
    defaultDescription?: string;
    ttlMs?: number;
  }
) {
  const ttlMs = params.ttlMs ?? DEFAULT_TTL_MS;
  const k1 = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs);
  return prisma.lnurlWithdrawSession.create({
    data: {
      tenantId: params.tenantId,
      k1,
      minWithdrawable: params.minWithdrawable,
      maxWithdrawable: params.maxWithdrawable,
      defaultDescription: params.defaultDescription,
      status: 'PENDING',
      expiresAt
    }
  });
}

export async function getWithdrawSession(prisma: PrismaClient, k1: string) {
  const session = await prisma.lnurlWithdrawSession.findUnique({ where: { k1 } });
  if (!session) return null;
  if (session.expiresAt <= new Date() && session.status !== 'EXPIRED') {
    return prisma.lnurlWithdrawSession.update({
      where: { k1 },
      data: { status: 'EXPIRED' }
    });
  }
  return session;
}

export function buildWithdrawRequest(
  origin: string,
  session: {
    k1: string;
    minWithdrawable: number;
    maxWithdrawable: number;
    defaultDescription?: string | null;
  }
) {
  return {
    tag: 'withdrawRequest',
    callback: `${origin}/api/lnurl-withdraw/callback`,
    k1: session.k1,
    minWithdrawable: session.minWithdrawable,
    maxWithdrawable: session.maxWithdrawable,
    defaultDescription: session.defaultDescription ?? 'nostrstack withdraw'
  };
}

async function payInvoiceViaLnBits(invoice: string) {
  if (!env.LN_BITS_URL || !env.LN_BITS_API_KEY) {
    throw new Error('lnbits_config_missing');
  }
  const res = await fetch(`${env.LN_BITS_URL}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': env.LN_BITS_API_KEY
    },
    body: JSON.stringify({ out: true, bolt11: invoice })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`lnbits_pay_failed:${res.status}:${text.slice(0, 120)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function settleWithdrawInvoice(
  prisma: PrismaClient,
  session: { k1: string; status: string },
  invoice: string
) {
  if (session.status === 'PAID') return session;
  if (env.LIGHTNING_PROVIDER !== 'lnbits') {
    throw new Error('provider_not_supported');
  }
  await payInvoiceViaLnBits(invoice);
  return prisma.lnurlWithdrawSession.update({
    where: { k1: session.k1 },
    data: { status: 'PAID' }
  });
}
