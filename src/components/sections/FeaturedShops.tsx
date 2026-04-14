import { useTranslations } from 'next-intl';

interface FeaturedShop {
  name: string;
  descKey: string;
  tags: string[];
  emoji: string;
  colorVar: string;
  url: string;
}

const SHOPS: FeaturedShop[] = [
  {
    name: 'Adriano Restaurant',
    descKey: 'adriano',
    tags: ['restaurant', 'menu', 'reservations'],
    emoji: '🍽️',
    colorVar: 'var(--color-restaurant)',
    url: 'https://adriano-trencin.vercel.app',
  },
  {
    name: 'Krajina Shop',
    descKey: 'krajina',
    tags: ['shop', 'payments', 'multilingual'],
    emoji: '🛒',
    colorVar: 'var(--color-shop)',
    url: 'https://krajina-trencin.vercel.app',
  },
  {
    name: 'LJ Servis',
    descKey: 'ljservis',
    tags: ['service', 'repair', 'electronics'],
    emoji: '🔧',
    colorVar: 'var(--color-service)',
    url: 'https://lj-servis.vercel.app',
  },
  {
    name: 'Barbershop Trenčín',
    descKey: 'barbershop',
    tags: ['barbershop', 'booking', 'beauty'],
    emoji: '✂️',
    colorVar: 'var(--color-barbershop)',
    url: 'https://barbershop-trencin.vercel.app',
  },
  {
    name: 'Transport Trenčín',
    descKey: 'transport',
    tags: ['transport', 'logistics', 'fleet'],
    emoji: '🚛',
    colorVar: 'var(--color-transport)',
    url: 'https://transportation-trencin.vercel.app',
  },
  {
    name: 'KrokShop',
    descKey: 'krokshop',
    tags: ['fashion', 'e-commerce', 'shoes'],
    emoji: '👟',
    colorVar: 'var(--color-fashion)',
    url: 'https://krokshop-trencin.vercel.app',
  },
  {
    name: 'DentCare',
    descKey: 'dentcare',
    tags: ['medical', 'dental', 'clinic'],
    emoji: '🦷',
    colorVar: 'var(--color-medical)',
    url: 'https://dentcare-trencin.vercel.app',
  },
  {
    name: 'ZenFlow',
    descKey: 'zenflow',
    tags: ['wellness', 'yoga', 'fitness'],
    emoji: '🧘',
    colorVar: 'var(--color-wellness)',
    url: 'https://zenflow-ivory.vercel.app',
  },
];

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ShopCard({ shop, index, t }: { shop: FeaturedShop; index: number; t: ReturnType<typeof useTranslations> }) {
  return (
    <a
      href={shop.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-xl hover:-translate-y-1"
    >
      {/* Card header with color accent */}
      <div
        className="relative h-48 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${shop.colorVar} 8%, transparent) 0%, color-mix(in srgb, ${shop.colorVar} 4%, transparent) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-7xl opacity-60 group-hover:scale-110 transition-transform duration-500">{shop.emoji}</span>
        </div>
        {/* Number badge */}
        <div className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white text-sm font-bold">
          {String(index + 1).padStart(2, '0')}
        </div>
        {/* Arrow on hover */}
        <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-secondary opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          <ArrowIcon />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold text-secondary">{shop.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral flex-1">
          {t(shop.descKey)}
        </p>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {shop.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${shop.colorVar} 10%, transparent)`,
                color: shop.colorVar,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}

export default function FeaturedShops() {
  const t = useTranslations('featuredShops');

  return (
    <section className="scroll-reveal bg-accent py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('badge')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-secondary sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral">
            {t('subtitle')}
          </p>
        </div>

        {/* Shop cards */}
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {SHOPS.map((shop, i) => (
            <ShopCard key={shop.url} shop={shop} index={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
