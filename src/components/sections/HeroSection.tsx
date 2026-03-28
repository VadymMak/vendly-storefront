'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BUSINESS_TYPES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

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

/* ── Stats icons ── */

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function UptimeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/* ── Quick Answer Banner ── */

function QuickAnswerBanner({ text }: { text: string }) {
  return (
    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm font-medium text-primary animate-fade-in">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

/* ── Stats Bar ── */

interface StatItem {
  icon: React.ReactNode;
  label: string;
}

function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-10 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 text-secondary/80">
          <span className="text-primary">{item.icon}</span>
          <span className="text-sm font-semibold sm:text-base">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Store Preview Mockup ── */

function PreviewMockup({ businessId }: { businessId: string }) {
  const data = PREVIEW_ITEMS[businessId];
  const business = BUSINESS_TYPES.find((b) => b.id === businessId);
  if (!data || !business) return null;

  return (
    <div className="animate-scale-in rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
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
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5 animate-slide-in-right sm:px-4 sm:py-3"
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
    // Resume auto-play after 12 seconds of inactivity
    const resume = setTimeout(() => setIsAutoPlaying(true), 12000);
    return () => clearTimeout(resume);
  };

  const stats: StatItem[] = [
    { icon: <StoreIcon />, label: t('statStores') },
    { icon: <GlobeIcon />, label: t('statCountries') },
    { icon: <LanguageIcon />, label: t('statLanguages') },
    { icon: <UptimeIcon />, label: t('statUptime') },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 animate-gradient-shift"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 25%, #f0fdf4 50%, #ecfdf5 75%, #f0fdf4 100%)',
          backgroundSize: '300% 300%',
        }}
      />

      {/* Decorative orbs with pulse */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/8 blur-3xl animate-pulse-glow" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-primary/6 blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/3 blur-3xl animate-pulse-glow" style={{ animationDelay: '3s' }} />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
        {/* Quick Answer Banner */}
        <div className="text-center">
          <QuickAnswerBanner text={t('quickAnswer')} />
        </div>

        {/* Main text */}
        <div className="text-center animate-fade-in-up">
          <Badge variant="primary">{t('badge')}</Badge>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-secondary sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral sm:text-lg">
            {t('subtitle')}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" href="#pricing">
              {t('cta')}
            </Button>
            <Button size="lg" variant="outline" href={`https://${BUSINESS_TYPES.find((b) => b.id === activeType)?.demo || 'vendshop.shop'}`}>
              {t('demo')}
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={stats} />

        {/* Business type selector + preview */}
        <div className="mt-16 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {/* Selector pills */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {BUSINESS_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeClick(type.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer sm:px-5 sm:py-2.5 ${
                  activeType === type.id
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'bg-white text-secondary border border-gray-200 hover:border-primary/30 hover:bg-accent'
                }`}
              >
                <span className="text-base">{type.icon}</span>
                <span className="hidden sm:inline">{tBiz(`${type.id}_title`)}</span>
              </button>
            ))}
          </div>

          {/* Auto-play indicator */}
          {isAutoPlaying && (
            <div className="mt-3 flex justify-center">
              <div className="flex items-center gap-1.5">
                {BUSINESS_TYPES.map((type) => (
                  <div
                    key={type.id}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      activeType === type.id ? 'w-6 bg-primary' : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preview area */}
          <div className="mx-auto mt-8 max-w-lg sm:max-w-xl">
            <PreviewMockup key={activeType} businessId={activeType} />
          </div>
        </div>
      </div>
    </section>
  );
}
