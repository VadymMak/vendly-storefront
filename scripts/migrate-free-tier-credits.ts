import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.studioCredits.updateMany({
    where: { planType: 'free' },
    data: {
      monthlyImages: 15,
      monthlyVideos: 0,
    },
  });

  console.log(`✅ Updated ${result.count} free-tier users: monthlyImages=15, monthlyVideos=0`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
