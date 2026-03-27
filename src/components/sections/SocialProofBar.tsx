import { BUSINESS_TYPES } from '@/lib/constants';

const BUSINESS_ICONS: Record<string, React.ReactNode> = {
  physical: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 6.5V15a1 1 0 001 1h10a1 1 0 001-1V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.5 3h15l-1.2 3.5H2.7L1.5 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  food: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 9a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2 12h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 4V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  restaurant: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 2v5a2 2 0 002 2h0a2 2 0 002-2V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 9v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 2v4c0 1.5-1 3-2 3h0v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  beauty: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="13" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  repair: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10.5 3.5a4 4 0 00-5.2 5.2L3 11l1 1 1 1 2.3-2.3a4 4 0 005.2-5.2L10 7 8 5l2.5-1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 13l-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  digital: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 16h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 13v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

function DotSeparator() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="mx-6 shrink-0 text-gray-300">
      <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
  );
}

function MarqueeItem({ id, title, demo }: { id: string; title: string; demo: string }) {
  return (
    <>
      <a
        href={`https://${demo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-neutral transition-colors hover:text-primary"
      >
        <span className="text-primary/70">{BUSINESS_ICONS[id]}</span>
        <span>{title}</span>
        <span className="text-xs text-neutral/50">{demo}</span>
      </a>
      <DotSeparator />
    </>
  );
}

export default function SocialProofBar() {
  return (
    <section className="overflow-hidden border-y border-gray-100 bg-gray-50/70 py-5">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-neutral/60">
        Dôverujú nám stovky podnikateľov v SK, CZ, UA a DE
      </p>

      <div className="relative">
        {/* Left / right fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-gray-50/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-gray-50/70 to-transparent" />

        <div className="flex animate-marquee items-center hover:[animation-play-state:paused]">
          {/* Duplicate the list so the loop is seamless */}
          {[...BUSINESS_TYPES, ...BUSINESS_TYPES].map((type, i) => (
            <MarqueeItem key={`${type.id}-${i}`} id={type.id} title={type.title} demo={type.demo} />
          ))}
        </div>
      </div>
    </section>
  );
}
