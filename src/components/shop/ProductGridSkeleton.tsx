import type { ColorSchemeTokens } from '@/lib/types';

interface ProductGridSkeletonProps {
  count?: number;
  scheme: ColorSchemeTokens;
}

export default function ProductGridSkeleton({ count = 8, scheme }: ProductGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex flex-col overflow-hidden rounded-2xl ${scheme.bgCard} ${scheme.border} border`}
        >
          {/* Image skeleton */}
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>

          {/* Info skeleton */}
          <div className="flex flex-1 flex-col p-4">
            {/* Title */}
            <div className="h-4 w-3/4 rounded-md bg-gray-200 animate-pulse" />
            {/* Description */}
            <div className="mt-2 h-3 w-full rounded-md bg-gray-100 animate-pulse" />
            <div className="mt-1 h-3 w-2/3 rounded-md bg-gray-100 animate-pulse" />

            {/* Price + button */}
            <div className="mt-auto flex items-center justify-between pt-3">
              <div className="h-6 w-20 rounded-md bg-gray-200 animate-pulse" />
              <div className="h-9 w-9 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
