'use client';

import { useState } from 'react';
import { SITE_URL } from '@/lib/constants';

function FreeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 8.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 11.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 14v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function NoCardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PERKS = [
  { icon: <FreeIcon />, label: 'Úplne zadarmo' },
  { icon: <NoCardIcon />, label: 'Bez kreditnej karty' },
  { icon: <ClockIcon />, label: 'Hotové za 5 minút' },
] as const;

export default function CtaSection() {
  const [shopName, setShopName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = shopName.trim();
    const url = name
      ? `${SITE_URL}/register?name=${encodeURIComponent(name)}`
      : `${SITE_URL}/register`;
    window.location.href = url;
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-secondary py-16 sm:py-24">
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          Začnite predávať online ešte dnes
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">
          Zadajte názov vášho obchodu a začnite za&nbsp;pár&nbsp;sekúnd.
          Žiadne záväzky, žiadne poplatky.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:gap-0"
        >
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Názov obchodu..."
            className="flex-1 rounded-lg border-2 border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 outline-none backdrop-blur-sm transition-colors focus:border-white/60 sm:rounded-r-none sm:border-r-0"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-primary transition-colors hover:bg-white/90 cursor-pointer sm:rounded-l-none"
          >
            <span>Vytvoriť obchod</span>
            <ArrowIcon />
          </button>
        </form>

        {/* Perks */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
          {PERKS.map((perk) => (
            <div key={perk.label} className="flex items-center gap-2 text-sm text-white/70">
              {perk.icon}
              <span>{perk.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
