import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find smak-shop store
  const store = await prisma.store.findUnique({
    where: { slug: 'smak-shop' },
    select: { id: true, name: true },
  });

  if (!store) {
    console.error('Store smak-shop not found!');
    process.exit(1);
  }

  console.log(`Found store: ${store.name} (${store.id})`);

  const reviews = [
    {
      storeId: store.id,
      author: 'Mária K.',
      rating: 5,
      text: 'Najlepšie domáce koláče v meste! Objednala som si makový závin a bol úplne fantastický — presne ako od babičky. Donáška bola rýchla a balenie veľmi pekné. Určite objednám znovu!',
      status: 'PUBLISHED' as const,
    },
    {
      storeId: store.id,
      author: 'Tomáš B.',
      rating: 4,
      text: 'Skvelý výber tradičných slovenských pochúťok. Bryndzové halušky boli výborné, aj keď porcia mohla byť o niečo väčšia. Obsluha veľmi milá a ochotná, rád sa vrátim.',
      status: 'PUBLISHED' as const,
    },
    {
      storeId: store.id,
      author: 'Jana V.',
      rating: 5,
      text: 'Konečne poriadny obchod s domácimi produktmi! Objednávam pravidelne a vždy je všetko čerstvé a chutné. Veľmi oceňujem aj možnosť donášky. Odporúčam každému, kto má rád kvalitné jedlo.',
      status: 'PUBLISHED' as const,
    },
  ];

  for (const review of reviews) {
    const created = await prisma.review.create({ data: review });
    console.log(`Created review by ${review.author} (${created.id})`);
  }

  console.log('Done! 3 reviews seeded.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
