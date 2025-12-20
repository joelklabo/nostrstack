import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_DOMAIN = process.env.TENANT_DOMAIN || 'demo.nostrstack.lol';
const TENANT_NAME = process.env.TENANT_NAME || 'Demo Tenant';
const USER_PUBKEY = process.env.USER_PUBKEY || 'f'.repeat(64);
const USER_NAME = process.env.USER_NAME || 'demo';
const LNURL_SUCCESS_ACTION =
  process.env.LNURL_SUCCESS_ACTION ||
  JSON.stringify({ tag: 'message', message: 'Thanks for the lightning tip!' });
const LNURL_METADATA = process.env.LNURL_METADATA || '';
const LNURL_COMMENT_ALLOWED = process.env.LNURL_COMMENT_ALLOWED || '';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { domain: TENANT_DOMAIN },
    update: { displayName: TENANT_NAME },
    create: { domain: TENANT_DOMAIN, displayName: TENANT_NAME }
  });

  await prisma.user.upsert({
    where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: USER_PUBKEY } },
    update: {
      lightningAddress: `${USER_NAME}@${tenant.domain}`,
      lnurlSuccessAction: LNURL_SUCCESS_ACTION,
      ...(LNURL_METADATA ? { lnurlMetadata: LNURL_METADATA } : {}),
      ...(Number.isFinite(Number(LNURL_COMMENT_ALLOWED)) && LNURL_COMMENT_ALLOWED !== ''
        ? { lnurlCommentAllowed: Number(LNURL_COMMENT_ALLOWED) }
        : {})
    },
    create: {
      pubkey: USER_PUBKEY,
      lightningAddress: `${USER_NAME}@${tenant.domain}`,
      tenantId: tenant.id,
      lnurlSuccessAction: LNURL_SUCCESS_ACTION,
      ...(LNURL_METADATA ? { lnurlMetadata: LNURL_METADATA } : {}),
      ...(Number.isFinite(Number(LNURL_COMMENT_ALLOWED)) && LNURL_COMMENT_ALLOWED !== ''
        ? { lnurlCommentAllowed: Number(LNURL_COMMENT_ALLOWED) }
        : {})
    }
  });

  console.log('Seed complete', { tenant: tenant.domain, user: USER_NAME });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
