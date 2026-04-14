'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BUSINESS_TYPES } from '@/lib/constants';
import Button from '@/components/ui/Button';

const PREVIEW_ITEMS: Record<string, { heading: string; products: string[] }> = {
  physical: {
    heading: 'Produkty',
    products: ['Ručne robené sviečky', 'Prírodná kozmetika', 'Keramické hrnčeky'],
  },
  food: {
    heading: 'Menu',
    products: ['Domáci chlieb', 'Farmársky med', 'Ovocné džemy'],
  },
  restaurant: {
    heading: 'Jedálny lístok',
    products: ['Margherita pizza', 'Pasta Carbonara', 'Tiramisu'],
  },
  beauty: {
    heading: 'Služby',
    products: ['Strih a styling', 'Manikúra gél', 'Masáž 60 min'],
  },
  repair: {
    heading: 'Služby',
    products: ['Výmena displeja', 'Oprava notebooku', 'Diagnostika zadarmo'],
  },
  digital: {
    heading: 'Produkty',
    products: ['Online kurz foto', 'E-book marketing', 'Šablóny Canva'],
  },
  events: {
    heading: 'Služby',
    products: ['Dekorácia osláv', 'Fotozone prenájom', 'Svadobné aranžmány'],
  },
  fashion: {
    heading: 'Produkty',
    products: ['Pánske tenisky', 'Dámske lodičky', 'Detská obuv'],
  },
  medical: {
    heading: 'Služby',
    products: ['Implantáty', 'Bielenie zubov', 'Ortodontia'],
  },
  wellness: {
    heading: 'Lekcie',
    products: ['Hatha Yoga', 'Vinyasa Flow', 'Meditácia'],
  },
};

/* ── Inline SVG icons ── */

function StorefrontIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="5" r="0.75" fill="#ef4444" />
      <circle cx="7.5" cy="5" r="0.75" fill="#eab308" />
      <circle cx="10" cy="5" r="0.75" fill="#22c55e" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M1 1h2l1.5 8h8L14 3.5H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="12.5" r="1" fill="currentColor" />
      <circle cx="11" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Store Preview Mockup ── */

function PreviewMockup({ businessId }: { businessId: string }) {
  const data = PREVIEW_ITEMS[businessId];
  const business = BUSINESS_TYPES.find((b) => b.id === businessId);
  if (!data || !business) return null;

  return (
    <div className="animate-scale-in rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs text-neutral border border-gray-200">
            <StorefrontIcon />
            <span>{business.demo || `${business.id}.vendshop.shop`}</span>
          </div>
        </div>
      </div>

      {/* Store header */}
      <div className="bg-primary px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{business.icon}</span>
            <span className="text-sm font-semibold text-white">{business.title}</span>
          </div>
          <div className="text-white/80">
            <CartIcon />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral mb-3">
          {data.heading}
        </p>
        <div className="space-y-2.5">
          {data.products.map((product, i) => (
            <div
              key={product}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5 animate-slide-in-right sm:px-4 sm:py-3"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="text-sm font-medium text-secondary">{product}</span>
              <div className="flex items-center gap-1 text-primary">
                <CheckIcon />
                <span className="text-xs font-medium">In stock</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-accent px-4 py-2.5">
          <span className="text-xs text-neutral">Objednávky dnes</span>
          <span className="text-sm font-bold text-primary">+12</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Hero Section ── */

const AUTO_ROTATE_INTERVAL = 4000;

export default function HeroSection() {
  const [activeType, setActiveType] = useState(BUSINESS_TYPES[0].id);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const t = useTranslations('hero');
  const tBiz = useTranslations('businessTypes');

  // Auto-rotate through business types
  const rotateNext = useCallback(() => {
    setActiveType((current) => {
      const idx = BUSINESS_TYPES.findIndex((b) => b.id === current);
      return BUSINESS_TYPES[(idx + 1) % BUSINESS_TYPES.length].id;
    });
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(rotateNext, AUTO_ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [isAutoPlaying, rotateNext]);

  const handleTypeClick = (id: string) => {
    setActiveType(id);
    setIsAutoPlaying(false);
    const resume = setTimeout(() => setIsAutoPlaying(true), 12000);
    return () => clearTimeout(resume);
  };

  return (
    <section className="relative overflow-hidden bg-green-50/40">
      {/* Background effects */}
      <div className="absolute inset-0">
        {/* Soft green radial glow */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #f0fdf4 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 100%, #dcfce7 0%, transparent 60%)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#16a34a 1px, transparent 1px), linear-gradient(90deg, #16a34a 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32 lg:px-8">
        {/* Two-column layout */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Text content */}
          <div className="animate-fade-in-up">
            {/* Quick Answer pill */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-sm font-medium text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('quickAnswer')}</span>
            </div>

            {/* Headline — two-tone */}
            <h1 className="text-4xl font-extrabold tracking-tight text-secondary sm:text-5xl lg:text-6xl xl:text-7xl">
              {t('titleLine1')}
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #15803d 100%)' }}
              >
                {t('titleLine2')}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral sm:text-xl">
              {t('subtitle')}
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button size="lg" href="/register">
                {t('cta')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                href={`https://${BUSINESS_TYPES.find((b) => b.id === activeType)?.demo || 'vendshop.shop'}`}
              >
                {t('demo')}
              </Button>
            </div>

            {/* Stats bar — glass cards */}
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { value: '500+', label: t('statStores') },
                { value: '4', label: t('statCountries') },
                { value: '5', label: t('statLanguages') },
                { value: '99.9%', label: t('statUptime') },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-200 bg-accent/50 px-4 py-3"
                >
                  <p className="text-2xl font-bold text-secondary sm:text-3xl">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-neutral sm:text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Interactive preview */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {/* Business type selector pills */}
            <div className="mb-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeClick(type.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer sm:px-4 sm:py-2 sm:text-sm ${
                    activeType === type.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-white text-secondary border border-gray-200 hover:border-primary/30 hover:bg-accent'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="hidden sm:inline">{tBiz(`${type.id}_title`)}</span>
                </button>
              ))}
            </div>

            {/* Auto-play dots */}
            {isAutoPlaying && (
              <div className="mb-4 flex justify-center gap-1.5 lg:justify-start">
                {BUSINESS_TYPES.map((type) => (
                  <div
                    key={type.id}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      activeType === type.id ? 'w-6 bg-primary' : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Preview mockup */}
            <PreviewMockup key={activeType} businessId={activeType} />
          </div>
        </div>
      </div>
    </section>
  );
}
