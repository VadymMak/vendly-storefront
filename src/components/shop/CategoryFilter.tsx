import Link from 'next/link';
import type { ColorSchemeTokens } from '@/lib/types';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  slug: string;
  scheme: ColorSchemeTokens;
}

export default function CategoryFilter({ categories, activeCategory, slug, scheme }: CategoryFilterProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Link
        href={`/`}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          !activeCategory
            ? `${scheme.accent}`
            : `${scheme.bgCard} ${scheme.textMuted} ${scheme.border} border hover:opacity-80`
        }`}
      >
        Všetko
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat}
          href={`/?category=${encodeURIComponent(cat)}`}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeCategory === cat
              ? `${scheme.accent}`
              : `${scheme.bgCard} ${scheme.textMuted} ${scheme.border} border hover:opacity-80`
          }`}
        >
          {cat}
        </Link>
      ))}
    </div>
  );
}
