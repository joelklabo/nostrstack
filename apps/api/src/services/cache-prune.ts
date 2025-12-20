import type { PrismaClient } from '@prisma/client';

export async function pruneExpiredNostrCache(prisma: PrismaClient, now: Date = new Date()) {
  const [eventResult, addressResult] = await Promise.all([
    prisma.nostrEventCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.nostrAddressCache.deleteMany({ where: { expiresAt: { lt: now } } })
  ]);

  return {
    events: eventResult.count,
    addresses: addressResult.count
  };
}
