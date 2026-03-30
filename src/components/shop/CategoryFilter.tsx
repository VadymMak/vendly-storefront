import Link from 'next/link';
import type { ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  slug: string;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function CategoryFilter({ categories, activeCategory, slug, scheme, t }: CategoryFilterProps) {
  return (
    <div className="relative mb-6">
      {/* Horizontal scrollable strip */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {/* "All" pill */}
        <Link
          href="/"
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
            !activeCategory
              ? 'border-[#3d2c1e] bg-[#3d2c1e] text-white shadow-sm'
              : `border-[#e8e0d6] bg-white text-[#6b6560] hover:border-[#d4641a] hover:text-[#d4641a]`
          }`}
        >
          {/* Grid icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          {t.allCategories}
        </Link>

        {/* Category pills */}
        {categories.map((cat) => (
          <Link
            key={cat}
            href={`/?category=${encodeURIComponent(cat)}`}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
              activeCategory === cat
                ? 'border-[#3d2c1e] bg-[#3d2c1e] text-white shadow-sm'
                : `border-[#e8e0d6] bg-white text-[#6b6560] hover:border-[#d4641a] hover:text-[#d4641a]`
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Fade edges on mobile (scroll hint) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#faf7f2] to-transparent sm:hidden" />
    </div>
  );
}
