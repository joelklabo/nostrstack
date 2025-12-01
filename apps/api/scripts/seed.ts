import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_DOMAIN = process.env.TENANT_DOMAIN || 'demo.nostrstack.lol';
const TENANT_NAME = process.env.TENANT_NAME || 'Demo Tenant';
const USER_PUBKEY = process.env.USER_PUBKEY || 'f'.repeat(64);
const USER_NAME = process.env.USER_NAME || 'demo';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { domain: TENANT_DOMAIN },
    update: { displayName: TENANT_NAME },
    create: { domain: TENANT_DOMAIN, displayName: TENANT_NAME }
  });

  await prisma.user.upsert({
    where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: USER_PUBKEY } },
    update: { lightningAddress: `${USER_NAME}@${tenant.domain}` },
    create: {
      pubkey: USER_PUBKEY,
      lightningAddress: `${USER_NAME}@${tenant.domain}`,
      tenantId: tenant.id
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
