import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const domain = 'localhost';
  const username = 'alice';
  const lightningAddress = `${username}@${domain}`;
  const lnurlSuccessAction = JSON.stringify({ tag: 'message', message: 'Thanks for the lightning tip!' });

  const tenant = await prisma.tenant.upsert({
    where: { domain },
    update: {},
    create: { domain, displayName: 'demo' }
  });

  await prisma.user.upsert({
    where: { tenantId_pubkey: { tenantId: tenant.id, pubkey: 'demo-pubkey' } },
    update: { lightningAddress, lnurlSuccessAction },
    create: {
      tenantId: tenant.id,
      pubkey: 'demo-pubkey',
      lightningAddress,
      lnurlSuccessAction
    }
  });

  console.log('Seeded demo tenant/user:', { domain, username, lightningAddress });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
