'use client';

import { useState } from 'react';
import { SITE_TAGLINE, BUSINESS_TYPES } from '@/lib/constants';
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
};

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
            <span>{business.demo}</span>
          </div>
        </div>
      </div>

      {/* Store header */}
      <div className="bg-primary px-6 py-4">
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
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral mb-3">
          {data.heading}
        </p>
        <div className="space-y-2.5">
          {data.products.map((product, i) => (
            <div
              key={product}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 animate-slide-in-right"
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

export default function HeroSection() {
  const [activeType, setActiveType] = useState(BUSINESS_TYPES[0].id);

  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent via-white to-white" />

      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-primary/5 blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
        {/* Top section — text */}
        <div className="text-center animate-fade-in-up">
          <Badge variant="primary">Nová platforma pre malý biznis</Badge>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-secondary sm:text-5xl lg:text-6xl">
            {SITE_TAGLINE}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral">
            Vytvorte si profesionálny online obchod bez technických znalostí.
            Predávajte produkty, prijímajte objednávky a rastite s&nbsp;VendShop.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" href="#pricing">
              Začať zadarmo
            </Button>
            <Button size="lg" variant="outline" href={`https://${BUSINESS_TYPES.find((b) => b.id === activeType)?.demo}`}>
              Pozrieť demo
            </Button>
          </div>
        </div>

        {/* Business type selector + preview */}
        <div className="mt-16 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {/* Selector pills */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {BUSINESS_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer sm:px-5 sm:py-2.5 ${
                  activeType === type.id
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'bg-white text-secondary border border-gray-200 hover:border-primary/30 hover:bg-accent'
                }`}
              >
                <span className="text-base">{type.icon}</span>
                <span className="hidden sm:inline">{type.title}</span>
              </button>
            ))}
          </div>

          {/* Preview area */}
          <div className="mx-auto mt-10 max-w-lg sm:max-w-xl">
            <PreviewMockup key={activeType} businessId={activeType} />
          </div>
        </div>
      </div>
    </section>
  );
}
