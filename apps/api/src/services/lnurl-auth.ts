import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import { secp256k1 } from '@noble/curves/secp256k1';
import type { PrismaClient } from '@prisma/client';
import { bech32 } from '@scure/base';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function isHex(value: string, length?: number) {
  if (!/^[0-9a-f]+$/i.test(value)) return false;
  if (length !== undefined) return value.length === length;
  return value.length % 2 === 0;
}

export function encodeLnurl(url: string): string {
  const normalized = new URL(url).toString();
  const words = bech32.toWords(new TextEncoder().encode(normalized));
  return bech32.encode('lnurl', words, 1000).toUpperCase();
}

export function buildLnurlAuthCallback(origin: string, k1: string) {
  const url = new URL('/api/lnurl-auth/callback', origin);
  url.searchParams.set('tag', 'login');
  url.searchParams.set('k1', k1);
  return url.toString();
}

export async function createLnurlAuthSession(prisma: PrismaClient, ttlMs = DEFAULT_TTL_MS) {
  const k1 = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs);
  return prisma.lnurlAuthSession.create({
    data: {
      k1,
      status: 'PENDING',
      expiresAt
    }
  });
}

export async function getLnurlAuthSession(prisma: PrismaClient, k1: string) {
  const session = await prisma.lnurlAuthSession.findUnique({ where: { k1 } });
  if (!session) return null;
  if (session.expiresAt <= new Date() && session.status !== 'EXPIRED') {
    return prisma.lnurlAuthSession.update({
      where: { k1 },
      data: { status: 'EXPIRED' }
    });
  }
  return session;
}

function verifySignature(k1: string, sig: string, key: string) {
  if (!isHex(k1, 64) || !isHex(sig, 128) || !isHex(key)) return false;
  try {
    const msg = Buffer.from(k1, 'hex');
    const signature = Buffer.from(sig, 'hex');
    const pubkey = Buffer.from(key, 'hex');
    return secp256k1.verify(signature, msg, pubkey);
  } catch {
    return false;
  }
}

export async function verifyLnurlAuthSession(
  prisma: PrismaClient,
  params: { k1: string; sig: string; key: string }
) {
  const session = await getLnurlAuthSession(prisma, params.k1);
  if (!session) {
    return { ok: false as const, reason: 'unknown_k1' };
  }
  if (session.status === 'EXPIRED') {
    return { ok: false as const, reason: 'expired' };
  }
  if (!verifySignature(params.k1, params.sig, params.key)) {
    return { ok: false as const, reason: 'invalid_signature' };
  }
  if (session.status === 'VERIFIED') {
    if (session.linkingKey === params.key) {
      return { ok: true as const, session };
    }
    return { ok: false as const, reason: 'already_used' };
  }
  if (session.status !== 'PENDING') {
    return { ok: false as const, reason: 'invalid_status' };
  }
  const updated = await prisma.lnurlAuthSession.update({
    where: { k1: params.k1 },
    data: {
      status: 'VERIFIED',
      linkingKey: params.key
    }
  });
  return { ok: true as const, session: updated };
}
