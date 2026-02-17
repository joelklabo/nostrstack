import type { PrismaClient } from '@prisma/client';

type LnurlUserRecord = {
  id: string;
  tenantId: string;
  pubkey: string;
  lightningAddress: string | null;
  lnurlMetadata: string | null;
  lnurlSuccessAction: string | null;
  lnurlCommentAllowed: number | null;
};

export async function findLnurlUserByIdentifier(
  prisma: PrismaClient,
  tenantId: string,
  identifier: string
) {
  const [user] = await prisma.$queryRaw<LnurlUserRecord[]>`
    SELECT
      id,
      tenantId,
      pubkey,
      "lightningAddress",
      "lnurlMetadata",
      "lnurlSuccessAction",
      "lnurlCommentAllowed"
    FROM "User"
    WHERE "tenantId" = ${tenantId}
      AND "lightningAddress" IS NOT NULL
      AND LOWER("lightningAddress") = LOWER(${identifier})
    LIMIT 1
  `;

  return user;
}
