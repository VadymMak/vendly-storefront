'use client';

import { useTranslations } from 'next-intl';
import { TESTIMONIALS, BUSINESS_TYPES } from '@/lib/constants';
import Badge from '@/components/ui/Badge';

/* ── Star rating ── */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={star <= rating ? '#facc15' : 'none'}
          stroke={star <= rating ? '#facc15' : '#d1d5db'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

/* ── Quote icon ── */

function QuoteIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-primary/15" aria-hidden="true">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" fill="currentColor" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" fill="currentColor" />
    </svg>
  );
}

/* ── Testimonial Card ── */

interface TestimonialCardProps {
  name: string;
  initials: string;
  businessType: string;
  rating: number;
  text: string;
}

function TestimonialCard({ name, initials, businessType, rating, text }: TestimonialCardProps) {
  const business = BUSINESS_TYPES.find((b) => b.id === businessType);

  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
      <QuoteIcon />

      <p className="mt-4 flex-1 text-sm leading-relaxed text-neutral sm:text-base">
        {text}
      </p>

      <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5">
        {/* Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-secondary">{name}</p>
          <div className="flex items-center gap-1.5">
            {business && <span className="text-xs">{business.icon}</span>}
            <span className="text-xs text-neutral">{business?.title}</span>
          </div>
        </div>

        <StarRating rating={rating} />
      </div>
    </div>
  );
}

/* ── Main Section ── */

export default function TestimonialsSection() {
  const t = useTranslations('testimonials');

  return (
    <section id="testimonials" className="scroll-reveal bg-accent py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <Badge variant="primary">{t('badge')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-neutral">
            {t('subtitle')}
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard
              key={testimonial.id}
              name={testimonial.name}
              initials={testimonial.avatarInitials}
              businessType={testimonial.businessType}
              rating={testimonial.rating}
              text={t(testimonial.textKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
